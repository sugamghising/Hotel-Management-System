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

/** Express Request extended with an optional raw body for webhook signature verification. */
type RequestWithRawBody = Request & { rawBody?: string | Buffer };
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

  /**
   * Creates a communications service with injectable repositories and providers.
   *
   * @param repo - Communication repository implementation.
   * @param providers - Channel provider registry.
   * @param guestRepo - Guest repository implementation.
   * @param hotelRepo - Hotel repository implementation.
   * @param reservationRepo - Reservation repository implementation.
   */
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

  /**
   * Sends a communication through the selected provider channel.
   *
   * Flow:
   * 1) resolves recipient and scoped entities,
   * 2) enforces channel opt-in (except `'ALERT'`),
   * 3) renders template-driven content when `templateId` is provided,
   * 4) creates a `PENDING` communication record,
   * 5) dispatches to provider and updates status to `QUEUED` or `FAILED`.
   *
   * Side effects:
   * - Database writes to `communications` table.
   * - Outbound call to provider adapter (`send`).
   * - Structured info/error logging.
   *
   * @param organizationId - Organization scope ID.
   * @param input - Send request payload.
   * @param userId - Optional initiating actor ID for metadata.
   * @returns Sent communication payload plus provider external ID.
   * @throws {NotFoundError} When recipient entities are missing.
   * @throws {ForbiddenError} When template scope does not match org/hotel context.
   * @throws {GuestOptOutError} When recipient has not opted in for the channel.
   * @throws {CommunicationDeliveryError} When provider dispatch fails.
   */
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

      // Enforce tenant scoping: template must belong to the same organization
      if (template.organizationId !== organizationId) {
        throw new ForbiddenError(
          `Template ${input.templateId} does not belong to organization ${organizationId}`
        );
      }

      // Enforce hotel scoping: if the template is scoped to a specific hotel, it must match
      if (template.hotelId) {
        if (!hotel || template.hotelId !== hotel.id) {
          throw new ForbiddenError(
            `Template ${input.templateId} is not available for the current hotel context`
          );
        }
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

      // Note: communication.sent outbox events are intentionally not emitted here
      // because there is currently no OutboxWorker handler/consumer for them.
      // Re-enable once a corresponding handler is wired up to avoid log noise and DB churn.

      return { communication: updatedComm, externalId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Update to FAILED - preserve existing metadata (e.g. createdBy)
      await this.repo.update(communication.id, {
        status: 'FAILED',
        metadata: {
          createdBy: userId ?? 'SYSTEM',
          error: errorMessage,
          failedAt: new Date().toISOString(),
        },
      });

      logger.error('Communication delivery failed', {
        communicationId: communication.id,
        channel: input.channel,
        error: errorMessage,
      });

      // Note: communication.failed outbox events are intentionally not emitted here
      // because there is currently no OutboxWorker handler/consumer for them.
      // Re-enable once a corresponding handler is wired up to avoid log noise and DB churn.

      throw new CommunicationDeliveryError(input.channel, errorMessage);
    }
  }

  // ============================================================================
  // SEND FOR RESERVATION (convenience method)
  // ============================================================================

  /**
   * Sends a reservation-scoped communication by auto-selecting template and channel.
   *
   * The method loads reservation, guest, and hotel context, derives preferred channel
   * when one is not supplied, validates opt-in rules, resolves template fallback, and
   * delegates to `send` for persistence and provider dispatch.
   *
   * @param reservationId - Reservation ID.
   * @param type - Communication type to send.
   * @param channel - Optional explicit channel override.
   * @param userId - Optional initiating actor ID.
   * @returns Send result from underlying `send` operation.
   */
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

  /**
   * Sends a template-based communication to many guests with bounded concurrency.
   *
   * The operation processes guest IDs in batches to limit parallel provider calls,
   * skips opt-out recipients for non-alert traffic, and returns per-guest statuses.
   *
   * @param organizationId - Organization scope ID.
   * @param input - Bulk send configuration and recipient list.
   * @param userId - Optional initiating actor ID.
   * @returns Aggregate bulk send counters and per-guest outcomes.
   * @remarks Complexity: O(G) guest lookups and send attempts, where G is recipient count.
   */
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

    // Enforce tenant scoping for the bulk template
    if (template.organizationId !== organizationId) {
      throw new ForbiddenError(
        `Template ${input.templateId} does not belong to organization ${organizationId}`
      );
    }

    const results: BulkSendResult['results'] = [];
    let sent = 0;
    let failed = 0;
    let skippedOptOut = 0;

    // Process guests in batches to avoid overwhelming the system
    const MAX_CONCURRENT_SENDS = 50;

    for (let i = 0; i < input.guestIds.length; i += MAX_CONCURRENT_SENDS) {
      const batchGuestIds = input.guestIds.slice(i, i + MAX_CONCURRENT_SENDS);

      const sendPromises = batchGuestIds.map(async (guestId) => {
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

  /**
   * Schedules a reservation-scoped communication for future delivery.
   *
   * This method resolves template/context now, renders final content, and stores
   * a `PENDING` communication row with `scheduledFor` so a scheduler can dispatch later.
   *
   * @param reservationId - Reservation ID.
   * @param type - Communication type to schedule.
   * @param scheduledFor - Planned send timestamp.
   * @param channel - Optional explicit channel override.
   * @param userId - Optional initiating actor ID.
   * @returns Persisted pending communication record.
   */
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

    // Check opt-in (unless ALERT type which bypasses)
    if (type !== 'ALERT') {
      this.checkOptIn(guest, effectiveChannel);
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

  /**
   * Applies provider webhook status updates to existing communications.
   *
   * Unknown external IDs and unknown provider statuses are logged and ignored so
   * webhook endpoints can remain idempotent and return success to providers.
   *
   * @param channel - Provider channel source (`EMAIL` or `SMS`).
   * @param externalId - Provider external message ID.
   * @param status - Provider delivery/open/bounce status.
   * @param timestamp - Provider event timestamp.
   * @returns Resolves after optional status update.
   */
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

  /**
   * Retrieves one communication while enforcing organization scope.
   *
   * @param organizationId - Organization scope ID.
   * @param communicationId - Communication ID.
   * @returns Scoped communication response.
   * @throws {NotFoundError} When communication does not exist in the organization.
   */
  async findById(organizationId: string, communicationId: string): Promise<CommunicationResponse> {
    const communication = await this.repo.findById(communicationId);
    if (!communication || communication.organizationId !== organizationId) {
      throw new NotFoundError(`Communication ${communicationId} not found`);
    }
    return communication;
  }

  /**
   * Searches organization communications with paginated output.
   *
   * @param organizationId - Organization scope ID.
   * @param filters - Search and pagination filters.
   * @returns Communication list response with pagination metadata.
   */
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

  /**
   * Lists communications associated with a scoped reservation.
   *
   * @param organizationId - Organization scope ID.
   * @param hotelId - Hotel scope ID.
   * @param reservationId - Reservation ID.
   * @returns Reservation communication history.
   * @throws {NotFoundError} When reservation is outside organization/hotel scope.
   */
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

  /**
   * Returns communication analytics for an organization.
   *
   * @param organizationId - Organization scope ID.
   * @param filters - Analytics date range and optional channel/type filters.
   * @returns Aggregated analytics payload.
   */
  async getAnalytics(
    organizationId: string,
    filters: AnalyticsQueryInput
  ): Promise<AnalyticsResponse> {
    return this.repo.getAnalytics(organizationId, filters);
  }

  // ============================================================================
  // TEMPLATE MANAGEMENT
  // ============================================================================

  /**
   * Creates a communication template after uniqueness validation.
   *
   * @param organizationId - Organization scope ID.
   * @param input - Template creation payload.
   * @param _userId - Optional actor ID (currently unused).
   * @returns Created template response.
   * @throws {ForbiddenError} When a duplicate code/channel/language template exists.
   */
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

  /**
   * Retrieves a template while enforcing organization scope.
   *
   * @param organizationId - Organization scope ID.
   * @param templateId - Template ID.
   * @returns Template response.
   * @throws {NotFoundError} When template is missing or outside scope.
   */
  async getTemplate(organizationId: string, templateId: string): Promise<TemplateResponse> {
    const template = await this.repo.findTemplateById(templateId);
    if (!template || template.organizationId !== organizationId) {
      throw new NotFoundError(`Template ${templateId} not found`);
    }
    return template;
  }

  /**
   * Searches organization templates with pagination metadata.
   *
   * @param organizationId - Organization scope ID.
   * @param filters - Template query filters.
   * @returns Template list response.
   */
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

  /**
   * Updates mutable template attributes.
   *
   * @param organizationId - Organization scope ID.
   * @param templateId - Template ID.
   * @param input - Partial template update payload.
   * @param _userId - Optional actor ID (currently unused).
   * @returns Updated template response.
   */
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

  /**
   * Deletes or deactivates a template depending on system-template flags.
   *
   * System templates are deactivated (`isActive=false`) while custom templates are
   * soft-deleted via `deletedAt`.
   *
   * @param organizationId - Organization scope ID.
   * @param templateId - Template ID.
   * @param _userId - Optional actor ID (currently unused).
   * @returns Resolves after delete/deactivate operation completes.
   */
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

  /**
   * Renders a preview for a stored template with optional context overrides.
   *
   * @param organizationId - Organization scope ID.
   * @param templateId - Template ID.
   * @param input - Preview request including optional context overrides.
   * @returns Rendered subject/body preview payload.
   */
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

  /**
   * Verifies communication-provider webhook signatures using raw request payload.
   *
   * Signature verification delegates to the selected provider implementation.
   * The method prefers captured raw request bytes because providers sign the
   * exact payload bytes, not parsed JSON objects.
   *
   * @param channel - Webhook channel (`EMAIL` or `SMS`).
   * @param req - Incoming webhook request.
   * @returns `true` when provider verification succeeds.
   */
  verifyWebhookSignature(channel: 'EMAIL' | 'SMS', req: Request): boolean {
    const provider =
      channel === 'EMAIL'
        ? getProviderForChannel(this.providers, 'EMAIL')
        : getProviderForChannel(this.providers, 'SMS');

    if (!provider.verifyWebhookSignature) {
      logger.warn(
        'Rejected communications webhook: provider does not implement verifyWebhookSignature',
        { channel }
      );
      return false;
    }

    const signatureHeader =
      req.headers['x-signature'] ??
      req.headers['x-provider-signature'] ??
      req.headers['x-twilio-signature'] ??
      req.headers['x-sendgrid-signature'];

    const signature = Array.isArray(signatureHeader)
      ? (signatureHeader[0] ?? '')
      : (signatureHeader ?? '');

    // Use raw body bytes for signature verification; providers sign the raw payload
    const rawBody = (req as RequestWithRawBody).rawBody;
    const body =
      typeof rawBody === 'string' || Buffer.isBuffer(rawBody)
        ? rawBody.toString('utf8')
        : JSON.stringify(req.body ?? {});

    const isValid = provider.verifyWebhookSignature(String(signature), body);

    if (!isValid) {
      logger.warn('Rejected communications webhook due to invalid signature', { channel });
    }

    return isValid;
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Resolves guest/reservation/hotel recipient context for an outbound send.
   *
   * @param organizationId - Organization scope ID.
   * @param input - Send input used to derive recipient context.
   * @returns Resolved recipient entities and channel-specific destination address.
   * @throws {NotFoundError} When required guest/reservation entities are missing or out of scope.
   */
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

  /**
   * Resolves destination address/token for a guest and communication channel.
   *
   * @param guest - Guest entity.
   * @param channel - Target provider channel.
   * @returns Email/mobile/guest ID destination string.
   * @throws {NotFoundError} When required contact data is missing.
   */
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

  /**
   * Enforces channel opt-in policy for a guest.
   *
   * @param guest - Guest entity.
   * @param channel - Channel to validate.
   * @returns Resolves when guest is opted in.
   * @throws {GuestOptOutError} When guest is not opted in for the channel.
   */
  private checkOptIn(
    guest: NonNullable<Awaited<ReturnType<GuestsRepository['findById']>>>,
    channel: ProviderChannel
  ): void {
    if (!this.hasOptIn(guest, channel)) {
      throw new GuestOptOutError(channel, guest.id);
    }
  }

  /**
   * Determines whether a guest has opted into a specific channel.
   *
   * @param guest - Guest entity.
   * @param channel - Channel to inspect.
   * @returns `true` when communication is allowed on the channel.
   */
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

  /**
   * Chooses the preferred outbound channel for a guest.
   *
   * Preference order: opted-in email first, then opted-in SMS.
   *
   * @param guest - Guest entity.
   * @returns Preferred channel or `null` when no eligible channel exists.
   */
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

  /**
   * Resolves destination address for a guest and channel.
   *
   * This helper mirrors `getToAddress` and is retained for compatibility with
   * existing internal call sites.
   *
   * @param guest - Guest entity.
   * @param channel - Channel to resolve.
   * @returns Email/mobile/guest ID destination string.
   */
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

  /**
   * Loads room number and type details for template context enrichment.
   *
   * @param roomId - Optional room ID linked to reservation assignment.
   * @returns Room metadata or `null` when not found/unassigned.
   */
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
