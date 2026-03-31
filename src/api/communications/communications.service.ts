import type { Request } from 'express';
import {
  CommunicationDeliveryError,
  ForbiddenError,
  GuestOptOutError,
  NotFoundError,
  TemplateMissingError,
  logger,
} from '../../core';
import { prisma } from '../../database/prisma';
import type { CommunicationChannel, CommunicationType } from '../../generated/prisma';
import { type GuestsRepository, guestsRepository } from '../guests/guests.repository';
import { type HotelRepository, hotelRepository } from '../hotel';
import { type ReservationsRepository, reservationsRepository } from '../reservations';
import type {
  AnalyticsQueryInput,
  CommunicationQueryInput,
  CreateTemplateInput,
  PreviewTemplateInput,
  TemplateQueryInput,
  UpdateTemplateInput,
} from './communications.dto';
import {
  type CommunicationsRepository,
  communicationsRepository,
} from './communications.repository';
import type {
  AnalyticsResponse,
  BulkSendResult,
  CommunicationListResponse,
  CommunicationResponse,
  PreviewResult,
  ProviderChannel,
  ProviderPayload,
  SendCommunicationInput,
  SendResult,
  TemplateListResponse,
  TemplateResponse,
  WebhookProviderStatus,
} from './communications.types';
import { type ProviderRegistry, defaultProviderRegistry, getProviderForChannel } from './providers';
import { buildContextFromData, render, preview as templatePreview } from './template.engine';

export class CommunicationsService {
  private repo: CommunicationsRepository;
  private providers: ProviderRegistry;
  private guestRepo: GuestsRepository;
  private hotelRepo: HotelRepository;
  private reservationRepo: ReservationsRepository;

  constructor(
    repo: CommunicationsRepository = communicationsRepository,
    providers: ProviderRegistry = defaultProviderRegistry,
    guestRepo: GuestsRepository = guestsRepository,
    hotelRepo: HotelRepository = hotelRepository,
    reservationRepo: ReservationsRepository = reservationsRepository
  ) {
    this.repo = repo;
    this.providers = providers;
    this.guestRepo = guestRepo;
    this.hotelRepo = hotelRepo;
    this.reservationRepo = reservationRepo;
  }

  // ============================================================================
  // SEND COMMUNICATION
  // ============================================================================

  async send(
    organizationId: string,
    input: SendCommunicationInput,
    userId?: string
  ): Promise<SendResult> {
    // 1. Resolve recipient
    const { guest, reservation, hotel, room, toAddress } = await this.resolveRecipient(
      organizationId,
      input
    );

    // 2. Check opt-in (unless ALERT type which bypasses)
    if (input.type !== 'ALERT') {
      this.checkOptIn(guest, input.channel);
    }

    // 3. Render content
    let subject = input.subject ?? null;
    let content = input.content ?? '';

    if (input.templateId) {
      const template = await this.repo.findTemplateById(input.templateId);
      if (!template) {
        throw new NotFoundError(`Template ${input.templateId} not found`);
      }

      const context = buildContextFromData({
        guest: {
          firstName: guest.firstName,
          lastName: guest.lastName,
          email: guest.email,
          mobile: guest.mobile,
          languageCode: guest.languageCode,
        },
        ...(reservation && {
          reservation: {
            confirmationNumber: reservation.confirmationNumber,
            checkInDate: reservation.checkInDate,
            checkOutDate: reservation.checkOutDate,
            nights: reservation.nights,
            totalAmount: reservation.totalAmount?.toString() ?? '0',
            currencyCode: hotel?.currencyCode ?? 'USD',
            specialRequests: reservation.guestNotes,
          },
        }),
        ...(room && {
          room: {
            number: room.number ?? '',
            typeName: room.typeName ?? '',
          },
        }),
        ...(hotel && {
          hotel: {
            name: hotel.name,
            phone: hotel.phone,
            email: hotel.email,
            addressLine1: hotel.addressLine1,
            city: hotel.city,
            stateProvince: hotel.stateProvince,
            postalCode: hotel.postalCode,
            checkInTime: hotel.checkInTime,
            checkOutTime: hotel.checkOutTime,
          },
        }),
      });

      content = render(template.bodyTemplate, context, {
        channel: input.channel as CommunicationChannel,
        languageCode: guest.languageCode,
      });

      if (template.subject) {
        subject = render(template.subject, context, {
          channel: input.channel as CommunicationChannel,
          languageCode: guest.languageCode,
        });
      }
    }

    // 4. Create Communication record with PENDING status
    const communication = await this.repo.create({
      organization: { connect: { id: organizationId } },
      ...(hotel && { hotel: { connect: { id: hotel.id } } }),
      ...(guest && { guest: { connect: { id: guest.id } } }),
      ...(reservation && { reservation: { connect: { id: reservation.id } } }),
      ...(input.templateId && { template: { connect: { id: input.templateId } } }),
      type: input.type as CommunicationType,
      channel: input.channel as CommunicationChannel,
      direction: 'OUTBOUND',
      subject,
      content,
      status: 'PENDING',
      toAddress,
      metadata: { createdBy: userId },
    });

    // 5. Dispatch to provider
    try {
      const provider = getProviderForChannel(this.providers, input.channel as CommunicationChannel);
      const providerPayload: ProviderPayload = {
        to: toAddress,
        content,
      };
      if (subject) {
        providerPayload.subject = subject;
      }
      const externalId = await provider.send(providerPayload);

      // Update to QUEUED
      const updatedComm = await this.repo.update(communication.id, {
        status: 'QUEUED',
        sentAt: new Date(),
        externalId,
      });

      logger.info('Communication sent successfully', {
        communicationId: communication.id,
        channel: input.channel,
        type: input.type,
        externalId,
      });

      // Emit event
      await this.emitEvent('communication.sent', {
        communicationId: communication.id,
        type: input.type,
        channel: input.channel,
        guestId: guest.id,
      });

      return { communication: updatedComm, externalId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Update to FAILED
      await this.repo.update(communication.id, {
        status: 'FAILED',
        metadata: {
          ...(communication.status === 'PENDING' ? {} : {}),
          error: errorMessage,
          failedAt: new Date().toISOString(),
        },
      });

      logger.error('Communication delivery failed', {
        communicationId: communication.id,
        channel: input.channel,
        error: errorMessage,
      });

      // Emit failure event
      await this.emitEvent('communication.failed', {
        communicationId: communication.id,
        type: input.type,
        channel: input.channel,
        error: errorMessage,
      });

      throw new CommunicationDeliveryError(input.channel, errorMessage);
    }
  }

  // ============================================================================
  // SEND FOR RESERVATION (convenience method)
  // ============================================================================

  async sendForReservation(
    reservationId: string,
    type: CommunicationType,
    channel?: CommunicationChannel,
    userId?: string
  ): Promise<SendResult> {
    // Load reservation with guest and hotel
    const reservation = await this.reservationRepo.findById(reservationId);
    if (!reservation) {
      throw new NotFoundError(`Reservation ${reservationId} not found`);
    }

    const guest = await this.guestRepo.findById(reservation.guestId);
    if (!guest) {
      throw new NotFoundError(`Guest ${reservation.guestId} not found`);
    }

    const hotel = await this.hotelRepo.findById(reservation.hotelId);
    if (!hotel) {
      throw new NotFoundError(`Hotel ${reservation.hotelId} not found`);
    }

    // Determine channel if not specified
    const effectiveChannel = channel ?? this.determinePreferredChannel(guest);
    if (!effectiveChannel) {
      throw new GuestOptOutError('all channels', guest.id);
    }

    // Check opt-in (unless ALERT type)
    if (type !== 'ALERT') {
      this.checkOptIn(guest, effectiveChannel);
    }

    // Find matching template
    const template = await this.repo.findTemplateForSend(
      reservation.organizationId,
      type,
      effectiveChannel,
      guest.languageCode,
      hotel.id
    );

    if (!template) {
      throw new TemplateMissingError(type, effectiveChannel, guest.languageCode);
    }

    // Send using the template
    return this.send(
      reservation.organizationId,
      {
        channel: effectiveChannel as ProviderChannel,
        type,
        guestId: guest.id,
        reservationId: reservation.id,
        templateId: template.id,
      },
      userId
    );
  }

  async sendBulk(
    organizationId: string,
    input: {
      guestIds: string[];
      channel: ProviderChannel;
      type: 'MARKETING' | 'ALERT';
      templateId: string;
    },
    userId?: string
  ): Promise<BulkSendResult> {
    const template = await this.repo.findTemplateById(input.templateId);
    if (!template) {
      throw new NotFoundError(`Template ${input.templateId} not found`);
    }

    const results: BulkSendResult['results'] = [];
    let sent = 0;
    let failed = 0;
    let skippedOptOut = 0;

    // Process all guests using Promise.allSettled
    const sendPromises = input.guestIds.map(async (guestId) => {
      const guest = await this.guestRepo.findById(guestId);
      if (!guest) {
        return { guestId, status: 'failed' as const, error: 'Guest not found' };
      }

      // Check opt-in (ALERT bypasses)
      if (input.type !== 'ALERT') {
        const hasOptIn = this.hasOptIn(guest, input.channel);
        if (!hasOptIn) {
          return { guestId, status: 'skipped_opt_out' as const };
        }
      }

      try {
        const result = await this.send(
          organizationId,
          {
            channel: input.channel,
            type: input.type,
            guestId,
            templateId: input.templateId,
          },
          userId
        );

        return {
          guestId,
          status: 'sent' as const,
          communicationId: result.communication.id,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { guestId, status: 'failed' as const, error: errorMessage };
      }
    });

    const settledResults = await Promise.allSettled(sendPromises);

    for (const result of settledResults) {
      if (result.status === 'fulfilled') {
        const value = result.value;
        results.push(value);

        if (value.status === 'sent') sent++;
        else if (value.status === 'failed') failed++;
        else if (value.status === 'skipped_opt_out') skippedOptOut++;
      } else {
        // Promise rejected (shouldn't happen with our error handling)
        failed++;
        results.push({
          guestId: 'unknown',
          status: 'failed',
          error: result.reason?.message ?? 'Unknown error',
        });
      }
    }

    logger.info('Bulk send completed', {
      organizationId,
      channel: input.channel,
      type: input.type,
      sent,
      failed,
      skippedOptOut,
      total: input.guestIds.length,
    });

    return { sent, failed, skippedOptOut, results };
  }

  // ============================================================================
  // SCHEDULE COMMUNICATION (for survey after checkout)
  // ============================================================================

  async scheduleForReservation(
    reservationId: string,
    type: CommunicationType,
    scheduledFor: Date,
    channel?: CommunicationChannel,
    userId?: string
  ): Promise<CommunicationResponse> {
    const reservation = await this.reservationRepo.findById(reservationId);
    if (!reservation) {
      throw new NotFoundError(`Reservation ${reservationId} not found`);
    }

    const guest = await this.guestRepo.findById(reservation.guestId);
    if (!guest) {
      throw new NotFoundError(`Guest ${reservation.guestId} not found`);
    }

    const hotel = await this.hotelRepo.findById(reservation.hotelId);

    const effectiveChannel = channel ?? this.determinePreferredChannel(guest);
    if (!effectiveChannel) {
      throw new GuestOptOutError('all channels', guest.id);
    }

    // Find template to get content
    const template = await this.repo.findTemplateForSend(
      reservation.organizationId,
      type,
      effectiveChannel,
      guest.languageCode,
      hotel?.id
    );

    if (!template) {
      throw new TemplateMissingError(type, effectiveChannel, guest.languageCode);
    }

    // Build context and render
    const context = buildContextFromData({
      guest: {
        firstName: guest.firstName,
        lastName: guest.lastName,
        email: guest.email,
        mobile: guest.mobile,
        languageCode: guest.languageCode,
      },
      reservation: {
        confirmationNumber: reservation.confirmationNumber,
        checkInDate: reservation.checkInDate,
        checkOutDate: reservation.checkOutDate,
        nights: reservation.nights,
        totalAmount: reservation.totalAmount?.toString() ?? '0',
        currencyCode: hotel?.currencyCode ?? 'USD',
        specialRequests: reservation.guestNotes,
      },
      ...(hotel && {
        hotel: {
          name: hotel.name,
          phone: hotel.phone,
          email: hotel.email,
          addressLine1: hotel.addressLine1,
          city: hotel.city,
          stateProvince: hotel.stateProvince,
          postalCode: hotel.postalCode,
          checkInTime: hotel.checkInTime,
          checkOutTime: hotel.checkOutTime,
        },
      }),
    });

    const content = render(template.bodyTemplate, context, {
      channel: effectiveChannel,
      languageCode: guest.languageCode,
    });

    const subject = template.subject
      ? render(template.subject, context, { channel: effectiveChannel })
      : null;

    const toAddress = this.getToAddress(guest, effectiveChannel);

    // Create PENDING communication with scheduledFor
    const communication = await this.repo.create({
      organization: { connect: { id: reservation.organizationId } },
      ...(hotel && { hotel: { connect: { id: hotel.id } } }),
      guest: { connect: { id: guest.id } },
      reservation: { connect: { id: reservation.id } },
      template: { connect: { id: template.id } },
      type,
      channel: effectiveChannel,
      direction: 'OUTBOUND',
      subject,
      content,
      status: 'PENDING',
      scheduledFor,
      toAddress,
      metadata: { createdBy: userId, scheduledAt: new Date().toISOString() },
    });

    logger.info('Communication scheduled', {
      communicationId: communication.id,
      type,
      channel: effectiveChannel,
      scheduledFor,
    });

    return communication;
  }

  // ============================================================================
  // WEBHOOK HANDLING
  // ============================================================================

  async handleWebhook(
    channel: 'EMAIL' | 'SMS',
    externalId: string,
    status: WebhookProviderStatus,
    timestamp: Date
  ): Promise<void> {
    const communication = await this.repo.findByExternalId(externalId);
    if (!communication) {
      logger.warn('Webhook received for unknown communication', { externalId, channel, status });
      return; // Don't throw - always return 200 to provider
    }

    // Map provider status to our status
    const statusMap: Record<WebhookProviderStatus, string> = {
      delivered: 'DELIVERED',
      opened: 'OPENED',
      failed: 'FAILED',
      bounced: 'BOUNCED',
      clicked: 'OPENED', // Treat click as open
      unsubscribed: 'DELIVERED', // Still delivered, but guest unsubscribed
    };

    const newStatus = statusMap[status];
    if (!newStatus) {
      logger.warn('Unknown webhook status', { externalId, status });
      return;
    }

    const updateData: Record<string, unknown> = {
      status: newStatus,
    };

    if (status === 'delivered') {
      updateData['deliveredAt'] = timestamp;
    } else if (status === 'opened' || status === 'clicked') {
      updateData['openedAt'] = timestamp;
      // Also set delivered if not already
      if (!communication.deliveredAt) {
        updateData['deliveredAt'] = timestamp;
      }
    }

    await this.repo.update(communication.id, updateData);

    logger.info('Communication status updated via webhook', {
      communicationId: communication.id,
      externalId,
      oldStatus: communication.status,
      newStatus,
    });
  }

  // ============================================================================
  // QUERY METHODS
  // ============================================================================

  async findById(organizationId: string, communicationId: string): Promise<CommunicationResponse> {
    const communication = await this.repo.findById(communicationId);
    if (!communication || communication.organizationId !== organizationId) {
      throw new NotFoundError(`Communication ${communicationId} not found`);
    }
    return communication;
  }

  async search(
    organizationId: string,
    filters: CommunicationQueryInput
  ): Promise<CommunicationListResponse> {
    const { communications, total } = await this.repo.search(organizationId, filters);

    return {
      communications,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  }

  async findByReservation(
    organizationId: string,
    hotelId: string,
    reservationId: string
  ): Promise<CommunicationResponse[]> {
    // Verify reservation belongs to org
    const reservation = await this.reservationRepo.findById(reservationId);
    if (
      !reservation ||
      reservation.organizationId !== organizationId ||
      reservation.hotelId !== hotelId
    ) {
      throw new NotFoundError(`Reservation ${reservationId} not found`);
    }

    return this.repo.findByReservationId(reservationId);
  }

  async getAnalytics(
    organizationId: string,
    filters: AnalyticsQueryInput
  ): Promise<AnalyticsResponse> {
    return this.repo.getAnalytics(organizationId, filters);
  }

  // ============================================================================
  // TEMPLATE MANAGEMENT
  // ============================================================================

  async createTemplate(
    organizationId: string,
    input: CreateTemplateInput,
    _userId?: string
  ): Promise<TemplateResponse> {
    // Check for duplicate code
    const existing = await this.repo.findTemplateByCode(
      organizationId,
      input.code,
      input.channel as CommunicationChannel,
      input.language ?? 'en'
    );

    if (existing) {
      throw new ForbiddenError(
        `Template with code '${input.code}' already exists for channel ${input.channel} and language ${input.language ?? 'en'}`
      );
    }

    const template = await this.repo.createTemplate({
      organization: { connect: { id: organizationId } },
      ...(input.hotelId && { hotel: { connect: { id: input.hotelId } } }),
      code: input.code,
      name: input.name,
      type: input.type as CommunicationType,
      channel: input.channel as CommunicationChannel,
      subject: input.subject ?? null,
      bodyTemplate: input.bodyTemplate,
      language: input.language ?? 'en',
      isActive: true,
      isSystem: false,
    });

    logger.info('Template created', {
      templateId: template.id,
      code: input.code,
      type: input.type,
      channel: input.channel,
    });

    return template;
  }

  async getTemplate(organizationId: string, templateId: string): Promise<TemplateResponse> {
    const template = await this.repo.findTemplateById(templateId);
    if (!template || template.organizationId !== organizationId) {
      throw new NotFoundError(`Template ${templateId} not found`);
    }
    return template;
  }

  async searchTemplates(
    organizationId: string,
    filters: TemplateQueryInput
  ): Promise<TemplateListResponse> {
    const { templates, total } = await this.repo.searchTemplates(organizationId, filters);

    return {
      templates,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  }

  async updateTemplate(
    organizationId: string,
    templateId: string,
    input: UpdateTemplateInput,
    _userId?: string
  ): Promise<TemplateResponse> {
    const existing = await this.repo.findTemplateById(templateId);
    if (!existing || existing.organizationId !== organizationId) {
      throw new NotFoundError(`Template ${templateId} not found`);
    }

    // Filter out undefined values and convert to Prisma-compatible format
    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) updateData['name'] = input.name;
    if (input.subject !== undefined) updateData['subject'] = input.subject;
    if (input.bodyTemplate !== undefined) updateData['bodyTemplate'] = input.bodyTemplate;
    if (input.language !== undefined) updateData['language'] = input.language;
    if (input.isActive !== undefined) updateData['isActive'] = input.isActive;

    const template = await this.repo.updateTemplate(templateId, updateData);

    logger.info('Template updated', { templateId, changes: Object.keys(updateData) });

    return template;
  }

  async deleteTemplate(
    organizationId: string,
    templateId: string,
    _userId?: string
  ): Promise<void> {
    const existing = await this.repo.findTemplateById(templateId);
    if (!existing || existing.organizationId !== organizationId) {
      throw new NotFoundError(`Template ${templateId} not found`);
    }

    // System templates cannot be deleted, only deactivated
    if (existing.isSystem) {
      await this.repo.updateTemplate(templateId, { isActive: false });
      logger.info('System template deactivated', { templateId });
    } else {
      await this.repo.softDeleteTemplate(templateId);
      logger.info('Template soft-deleted', { templateId });
    }
  }

  async previewTemplate(
    organizationId: string,
    templateId: string,
    input: PreviewTemplateInput
  ): Promise<PreviewResult> {
    const template = await this.repo.findTemplateById(templateId);
    if (!template || template.organizationId !== organizationId) {
      throw new NotFoundError(`Template ${templateId} not found`);
    }

    return templatePreview(template.subject, template.bodyTemplate, input.context, {
      channel: template.channel as CommunicationChannel,
    });
  }

  verifyWebhookSignature(channel: 'EMAIL' | 'SMS', req: Request): boolean {
    const provider =
      channel === 'EMAIL'
        ? getProviderForChannel(this.providers, 'EMAIL')
        : getProviderForChannel(this.providers, 'SMS');

    if (!provider.verifyWebhookSignature) {
      return true;
    }

    const signatureHeader =
      req.headers['x-signature'] ??
      req.headers['x-provider-signature'] ??
      req.headers['x-twilio-signature'] ??
      req.headers['x-sendgrid-signature'];

    const signature = Array.isArray(signatureHeader)
      ? (signatureHeader[0] ?? '')
      : (signatureHeader ?? '');
    const body = JSON.stringify(req.body ?? {});

    const isValid = provider.verifyWebhookSignature(String(signature), body);

    if (!isValid) {
      logger.warn('Rejected communications webhook due to invalid signature', { channel });
    }

    return isValid;
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private async resolveRecipient(
    organizationId: string,
    input: SendCommunicationInput
  ): Promise<{
    guest: NonNullable<Awaited<ReturnType<GuestsRepository['findById']>>>;
    reservation: Awaited<ReturnType<ReservationsRepository['findById']>> | null;
    hotel: Awaited<ReturnType<HotelRepository['findById']>> | null;
    room: { number: string | null; typeName: string | null } | null;
    toAddress: string;
  }> {
    let reservation = null;
    let hotel = null;
    const room = null;

    // Load reservation if provided
    if (input.reservationId) {
      reservation = await this.reservationRepo.findById(input.reservationId);
      if (!reservation || reservation.organizationId !== organizationId) {
        throw new NotFoundError(`Reservation ${input.reservationId} not found`);
      }

      hotel = await this.hotelRepo.findById(reservation.hotelId);

      // Note: Room info would need to be loaded through reservation relations if needed
    }

    // Determine guest ID
    const guestId = input.guestId ?? reservation?.guestId;
    if (!guestId) {
      throw new NotFoundError('Guest ID is required');
    }

    const guest = await this.guestRepo.findById(guestId);
    if (!guest || guest.organizationId !== organizationId) {
      throw new NotFoundError(`Guest ${guestId} not found`);
    }

    // Determine to address based on channel
    const toAddress = this.getToAddress(guest, input.channel);

    return { guest, reservation, hotel, room, toAddress };
  }

  private getToAddress(
    guest: NonNullable<Awaited<ReturnType<GuestsRepository['findById']>>>,
    channel: ProviderChannel
  ): string {
    switch (channel) {
      case 'EMAIL':
        if (!guest.email) {
          throw new NotFoundError('Guest does not have an email address');
        }
        return guest.email;
      case 'SMS':
      case 'WHATSAPP':
        if (!guest.mobile) {
          throw new NotFoundError('Guest does not have a mobile number');
        }
        return guest.mobile;
      case 'PUSH':
        // For push, use guest ID as the identifier
        return guest.id;
      default:
        throw new NotFoundError(`Unknown channel: ${channel}`);
    }
  }

  private checkOptIn(
    guest: NonNullable<Awaited<ReturnType<GuestsRepository['findById']>>>,
    channel: ProviderChannel
  ): void {
    if (!this.hasOptIn(guest, channel)) {
      throw new GuestOptOutError(channel, guest.id);
    }
  }

  private hasOptIn(
    guest: NonNullable<Awaited<ReturnType<GuestsRepository['findById']>>>,
    channel: ProviderChannel
  ): boolean {
    switch (channel) {
      case 'EMAIL':
        return guest.emailOptIn === true;
      case 'SMS':
      case 'WHATSAPP':
        return guest.smsOptIn === true;
      case 'PUSH':
        // Push notifications don't require opt-in in this model
        return true;
      default:
        return false;
    }
  }

  private determinePreferredChannel(
    guest: NonNullable<Awaited<ReturnType<GuestsRepository['findById']>>>
  ): CommunicationChannel | null {
    // Prefer email, then SMS
    if (guest.emailOptIn && guest.email) {
      return 'EMAIL';
    }
    if (guest.smsOptIn && guest.mobile) {
      return 'SMS';
    }
    return null;
  }

  private async emitEvent(eventType: string, payload: Record<string, unknown>): Promise<void> {
    try {
      await prisma.outboxEvent.create({
        data: {
          eventType,
          aggregateType: 'Communication',
          aggregateId: payload['communicationId'] as string,
          payload: payload as object,
        },
      });
    } catch (error) {
      logger.error('Failed to emit event', { eventType, error });
      // Don't throw - event emission failure shouldn't fail the operation
    }
  }

  private resolveToAddress(
    guest: NonNullable<Awaited<ReturnType<GuestsRepository['findById']>>>,
    channel: ProviderChannel
  ): string {
    switch (channel) {
      case 'EMAIL':
        if (!guest.email) {
          throw new NotFoundError('Guest does not have an email address');
        }
        return guest.email;
      case 'SMS':
      case 'WHATSAPP':
        if (!guest.mobile) {
          throw new NotFoundError('Guest does not have a mobile number');
        }
        return guest.mobile;
      case 'PUSH':
        return guest.id;
      default:
        throw new NotFoundError(`Unknown channel: ${channel}`);
    }
  }

  private async getRoom(
    roomId: string | null | undefined
  ): Promise<{ number: string | null; typeName: string | null } | null> {
    if (!roomId) {
      return null;
    }

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        roomType: {
          select: { name: true },
        },
      },
    });

    if (!room) {
      return null;
    }

    return {
      number: room.roomNumber,
      typeName: room.roomType?.name ?? null,
    };
  }
}

export const communicationsService = new CommunicationsService();
