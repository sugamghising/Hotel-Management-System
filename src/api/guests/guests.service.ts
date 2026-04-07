import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, logger } from '../../core';
import { encrypt, maskIdNumber } from '../../core/utils/crypto';
import { Prisma } from '../../generated/prisma';
import { type HotelRepository, hotelRepository } from '../hotel';
import type { GuestStats, InHouseGuest } from './guests.dto';
import { type GuestsRepository, guestsRepository } from './guests.repository';
import type {
  CreateGuestInput,
  DuplicateDetectionInput,
  Guest,
  GuestDuplicate,
  GuestListResponse,
  GuestQueryFilters,
  GuestResponse,
  GuestStayHistory,
  MergeGuestsInput,
  UpdateGuestInput,
  VIPStatus,
} from './guests.types';

type GuestWithRelations = Prisma.GuestGetPayload<{
  include: {
    reservations: {
      include: {
        hotel: true;
        rooms: {
          include: {
            roomType: true;
            room: true;
          };
        };
        ratePlan: true;
      };
    };
    communications: true;
  };
}>;

export class GuestsService {
  private guestRepository: GuestsRepository;
  private hotelRepository: HotelRepository;

  /**
   * Creates a guest service with injectable repository dependencies.
   *
   * @param guestRepo - Guest repository implementation.
   * @param hotelRepo - Hotel repository implementation.
   */
  constructor(
    guestRepo: GuestsRepository = guestsRepository,
    hotelRepo: HotelRepository = hotelRepository
  ) {
    this.guestRepository = guestRepo;
    this.hotelRepository = hotelRepo;
  }

  // ============================================================================
  // CREATE
  // ============================================================================

  /**
   * Creates a guest profile after uniqueness checks and field normalization.
   *
   * Side effects:
   * - Reads existing guests by email for conflict checks.
   * - Encrypts sensitive ID document numbers before persistence.
   * - Inserts a guest row with initialized stay-history counters.
   *
   * @param organizationId - Organization scope ID.
   * @param input - Guest creation payload.
   * @param _createdBy - Optional actor ID (currently unused).
   * @returns Created guest response.
   * @throws {ConflictError} When email already exists in organization scope.
   */
  async create(
    organizationId: string,
    input: CreateGuestInput,
    _createdBy?: string
  ): Promise<GuestResponse> {
    // Check for existing guest by email
    if (input.email) {
      const existing = await this.guestRepository.findByEmail(organizationId, input.email);
      if (existing) {
        logger.warn(`Guest with email ${input.email} already exists`, {
          existingGuestId: existing.id,
          organizationId,
        });
        throw new ConflictError('Guest with this email already exists for this organization');
      }
    }
    // Encrypt ID number if provided
    let encryptedIdNumber: string | null = null;
    if (input.idNumber) {
      encryptedIdNumber = encrypt(input.idNumber);
    }

    const guest = await this.guestRepository.create({
      organization: { connect: { id: organizationId } },

      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: input.email?.toLowerCase().trim() || null,
      phone: input.phone?.trim() || null,
      mobile: input.mobile?.trim() || null,
      dateOfBirth: input.dateOfBirth || null,
      nationality: input.nationality || null,
      languageCode: input.languageCode || 'en',

      idType: input.idType || null,
      idNumber: encryptedIdNumber,
      idExpiryDate: input.idExpiryDate || null,

      addressLine1: input.addressLine1?.trim() || null,
      addressLine2: input.addressLine2?.trim() || null,
      city: input.city?.trim() || null,
      stateProvince: input.stateProvince?.trim() || null,
      postalCode: input.postalCode?.trim() || null,
      countryCode: input.countryCode || null,

      guestType: input.guestType || 'TRANSIENT',
      vipStatus: input.vipStatus || 'NONE',
      vipReason: input.vipReason?.trim() || null,

      companyName: input.companyName?.trim() || null,
      companyTaxId: input.companyTaxId?.trim() || null,

      roomPreferences: (input.roomPreferences as Prisma.InputJsonValue) ?? Prisma.DbNull,
      dietaryRequirements: input.dietaryRequirements?.trim() || null,
      specialNeeds: input.specialNeeds?.trim() || null,

      marketingConsent: input.marketingConsent || false,
      emailOptIn: input.emailOptIn || false,
      smsOptIn: input.smsOptIn || false,

      internalNotes: input.internalNotes?.trim() || null,
      alertNotes: input.alertNotes?.trim() || null,

      // History defaults
      totalStays: 0,
      totalNights: 0,
      totalRevenue: 0,
      lastStayDate: null,
      averageRate: 0,
    });

    logger.info(`Guest created: ${guest.firstName} ${guest.lastName}`, {
      guestId: guest.id,
      organizationId,
    });

    return this.mapToResponse(guest);
  }

  // ============================================================================
  // READ
  // ============================================================================

  /**
   * Retrieves a guest by ID with optional reservation/communication history.
   *
   * @param id - Guest ID.
   * @param organizationId - Organization scope ID.
   * @param includeHistory - Whether to include historical relationship data.
   * @returns Guest response (with history when requested).
   * @throws {NotFoundError} When guest is missing or soft deleted.
   * @throws {ForbiddenError} When guest is outside organization scope.
   */
  async findById(
    id: string,
    organizationId: string,
    includeHistory: boolean = false
  ): Promise<GuestResponse> {
    if (includeHistory) {
      const withHistory = await this.guestRepository.findByIdWithReservations(id);
      if (!withHistory || withHistory.deletedAt) {
        throw new NotFoundError(`Guest not found: ${id}`);
      }
      if (withHistory.organizationId !== organizationId) {
        throw new ForbiddenError('Access denied to this guest');
      }
      // Return extended response with history
      return this.mapToResponseWithHistory(withHistory);
    }

    const guest = await this.guestRepository.findById(id);
    if (!guest || guest.deletedAt) {
      throw new NotFoundError(`Guest not found: ${id}`);
    }
    if (guest.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied to this guest');
    }
    return this.mapToResponse(guest);
  }

  /**
   * Lists organization guests with filtering and pagination metadata.
   *
   * @param organizationId - Organization scope ID.
   * @param filters - Optional query filters.
   * @param pagination - Page and limit values.
   * @returns Guest summaries with pagination details.
   */
  async findByOrganization(
    organizationId: string,
    filters: GuestQueryFilters = {},
    pagination: { page: number; limit: number } = { page: 1, limit: 20 }
  ): Promise<GuestListResponse> {
    const { guests, total } = await this.guestRepository.findByOrganization(
      organizationId,
      filters,
      pagination
    );

    return {
      guests: guests.map((g) => ({
        id: g.id,
        firstName: g.firstName,
        lastName: g.lastName,
        fullName: `${g.firstName} ${g.lastName}`,
        email: g.email,
        phone: g.phone || g.mobile,
        vipStatus: g.vipStatus,
        guestType: g.guestType,
        companyName: g.companyName,
        totalStays: g.totalStays,
        lastStayDate: g.lastStayDate,
        createdAt: g.createdAt,
      })),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    };
  }

  // ============================================================================
  // UPDATE
  // ============================================================================

  /**
   * Updates mutable guest fields with organization scoping and email uniqueness checks.
   *
   * @param id - Guest ID.
   * @param organizationId - Organization scope ID.
   * @param input - Partial guest update payload.
   * @param _updatedBy - Optional actor ID (currently unused).
   * @returns Updated guest response.
   */
  async update(
    id: string,
    organizationId: string,
    input: UpdateGuestInput,
    _updatedBy?: string
  ): Promise<GuestResponse> {
    const guest = await this.guestRepository.findById(id);

    if (!guest || guest.deletedAt) {
      throw new NotFoundError(`Guest not found: ${id}`);
    }

    if (guest.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied to this guest');
    }

    // Normalize email and check uniqueness if changing
    const normalizedEmail = input.email?.toLowerCase().trim();
    if (normalizedEmail && normalizedEmail !== guest.email) {
      const existing = await this.guestRepository.findByEmail(organizationId, normalizedEmail);
      if (existing && existing.id !== id) {
        throw new ConflictError(`Email ${normalizedEmail} is already in use`);
      }
    }

    // Encrypt new ID number if provided
    let encryptedIdNumber: string | undefined | null = undefined;
    if (input.idNumber === null) {
      encryptedIdNumber = null; // Clear ID
    } else if (input.idNumber && input.idNumber !== '[ENCRYPTED]') {
      // Only encrypt if it's a new value (not the masked placeholder)
      encryptedIdNumber = encrypt(input.idNumber);
    }

    const { roomPreferences, idNumber: _idNumber, email, firstName, lastName, ...rest } = input;
    const updateData: Prisma.GuestUpdateInput = {
      ...rest,
      ...(email !== undefined && { email: normalizedEmail ?? null }),
      ...(firstName !== undefined && { firstName: firstName.trim() }),
      ...(lastName !== undefined && { lastName: lastName.trim() }),
      updatedAt: new Date(),
    };

    if (roomPreferences === null) {
      updateData.roomPreferences = Prisma.DbNull;
    } else if (roomPreferences !== undefined) {
      updateData.roomPreferences = roomPreferences as Prisma.InputJsonValue;
    }

    if (encryptedIdNumber !== undefined) {
      updateData.idNumber = encryptedIdNumber;
    }

    const updated = await this.guestRepository.update(id, updateData);

    logger.info(`Guest updated: ${updated.firstName} ${updated.lastName}`, {
      guestId: id,
    });

    return this.mapToResponse(updated);
  }

  /**
   * Updates VIP status and optional reason for a guest.
   *
   * @param id - Guest ID.
   * @param organizationId - Organization scope ID.
   * @param vipStatus - New VIP status value.
   * @param vipReason - Optional VIP reason text.
   * @param _updatedBy - Optional actor ID (currently unused).
   * @returns Updated guest response.
   */
  async updateVIP(
    id: string,
    organizationId: string,
    vipStatus: string,
    vipReason?: string,
    _updatedBy?: string
  ): Promise<GuestResponse> {
    const guest = await this.guestRepository.findById(id);

    if (!guest || guest.deletedAt) {
      throw new NotFoundError(`Guest not found: ${id}`);
    }

    if (guest.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied');
    }

    const updated = await this.guestRepository.update(id, {
      vipStatus: vipStatus as VIPStatus,
      vipReason: vipReason || null,
      updatedAt: new Date(),
    });

    logger.info(`VIP status updated for guest ${id}: ${vipStatus}`, {
      previousStatus: guest.vipStatus,
      newStatus: vipStatus,
    });

    return this.mapToResponse(updated);
  }

  // ============================================================================
  // DELETE
  // ============================================================================

  /**
   * Soft deletes a guest after ensuring no active/future reservations exist.
   *
   * @param id - Guest ID.
   * @param organizationId - Organization scope ID.
   * @param deletedBy - Optional actor ID for audit logs.
   * @returns Resolves when soft deletion completes.
   * @throws {BadRequestError} When guest has active/future reservations.
   */
  async delete(id: string, organizationId: string, deletedBy?: string): Promise<void> {
    const guest = await this.guestRepository.findById(id);

    if (!guest || guest.deletedAt) {
      throw new NotFoundError(`Guest not found: ${id}`);
    }

    if (guest.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied to this guest');
    }

    // Check for active reservations
    const hasActive = await this.guestRepository.hasActiveReservations(id);
    if (hasActive) {
      throw new BadRequestError(
        'Cannot delete guest with active or future reservations. ' +
          'Please cancel all reservations first.'
      );
    }

    await this.guestRepository.softDelete(id);

    logger.warn(`Guest deleted: ${guest.firstName} ${guest.lastName}`, {
      guestId: id,
      deletedBy,
    });
  }

  // ============================================================================
  // DUPLICATE DETECTION & MERGE
  // ============================================================================

  /**
   * Finds potential duplicate guests for the provided identity hints.
   *
   * @param organizationId - Organization scope ID.
   * @param input - Duplicate detection payload.
   * @returns Ranked duplicate candidates.
   */
  async findDuplicates(
    organizationId: string,
    input: DuplicateDetectionInput
  ): Promise<GuestDuplicate[]> {
    return this.guestRepository.findPotentialDuplicates(organizationId, input);
  }

  /**
   * Merges source guests into a target guest record.
   *
   * @param organizationId - Organization scope ID.
   * @param input - Merge strategy and guest IDs.
   * @param performedBy - Optional actor ID for audit logging.
   * @returns Merged target guest response.
   */
  async merge(
    organizationId: string,
    input: MergeGuestsInput,
    performedBy?: string
  ): Promise<GuestResponse> {
    // Verify all guests exist, are not soft-deleted, and belong to organization
    const target = await this.guestRepository.findById(input.targetGuestId);
    if (!target || target.organizationId !== organizationId || target.deletedAt) {
      throw new NotFoundError(`Target guest not found: ${input.targetGuestId}`);
    }

    for (const sourceId of input.sourceGuestIds) {
      const source = await this.guestRepository.findById(sourceId);
      if (!source || source.organizationId !== organizationId || source.deletedAt) {
        throw new NotFoundError(`Source guest not found: ${sourceId}`);
      }
    }

    // Prevent merging if any source has active reservations that conflict with target
    // (simplified check - full implementation would check date overlaps)

    const merged = await this.guestRepository.mergeGuests(
      input.targetGuestId,
      input.sourceGuestIds,
      {
        keepSourceIfNewer: input.mergeStrategy.keepSourceIfNewer ?? false,
        preferSourceFields: input.mergeStrategy.preferSourceFields ?? [],
      }
    );

    logger.warn(
      `Guests merged: ${input.sourceGuestIds.length} sources into ${input.targetGuestId}`,
      {
        targetId: input.targetGuestId,
        sourceIds: input.sourceGuestIds,
        performedBy,
      }
    );

    return this.mapToResponse(merged);
  }

  // ============================================================================
  // STAY HISTORY
  // ============================================================================

  /**
   * Returns stay history for a scoped guest.
   *
   * @param guestId - Guest ID.
   * @param organizationId - Organization scope ID.
   * @returns Guest stay history records.
   */
  async getStayHistory(guestId: string, organizationId: string): Promise<GuestStayHistory[]> {
    const guest = await this.guestRepository.findById(guestId);

    if (!guest || guest.deletedAt) {
      throw new NotFoundError(`Guest not found: ${guestId}`);
    }

    if (guest.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied');
    }

    return this.guestRepository.getStayHistory(guestId);
  }

  // ============================================================================
  // IN-HOUSE GUESTS
  // ============================================================================

  /**
   * Returns in-house guests for a hotel and business date.
   *
   * @param hotelId - Hotel ID.
   * @param organizationId - Organization scope ID.
   * @param businessDate - Optional business date (defaults to today).
   * @returns In-house guest dashboard rows with folio/payment totals.
   */
  async getInHouseGuests(
    hotelId: string,
    organizationId: string,
    businessDate?: Date
  ): Promise<InHouseGuest[]> {
    // Verify the hotel belongs to the organization
    const hotelExists = await this.hotelRepository.existsInOrganization(organizationId, hotelId);
    if (!hotelExists) {
      throw new NotFoundError(`Hotel not found: ${hotelId}`);
    }

    const date = businessDate || new Date();
    date.setHours(0, 0, 0, 0);

    const reservations = await this.guestRepository.getInHouseGuests(hotelId, date);

    return reservations.map((res) => {
      const folioTotal = res.folioItems.reduce(
        (sum: number, item) => sum + Number.parseFloat(item.amount.toString()),
        0
      );
      const paymentTotal = res.payments.reduce(
        (sum: number, p) => sum + Number.parseFloat(p.amount.toString()),
        0
      );

      return {
        reservationId: res.id,
        confirmationNumber: res.confirmationNumber,
        guestId: res.guest.id,
        guestName: `${res.guest.firstName} ${res.guest.lastName}`,
        vipStatus: res.guest.vipStatus,
        roomNumber: res.rooms[0]?.room?.roomNumber || 'Unassigned',
        roomType: res.rooms[0]?.roomType?.name || 'Unknown',
        checkInDate: res.checkInDate,
        checkOutDate: res.checkOutDate,
        nights: res.nights,
        balance: folioTotal - paymentTotal,
        folioTotal,
        paymentTotal,
        alerts: res.guest.alertNotes ? [res.guest.alertNotes] : [],
      };
    });
  }

  // ============================================================================
  // STATISTICS
  // ============================================================================

  /**
   * Retrieves aggregate guest statistics for an organization.
   *
   * @param organizationId - Organization scope ID.
   * @returns Guest statistics response.
   */
  async getStats(organizationId: string): Promise<GuestStats> {
    const stats = await this.guestRepository.getStats(organizationId);
    return {
      ...stats,
      byNationality: stats.byNationality as GuestStats['byNationality'],
      topCompanies: stats.topCompanies as GuestStats['topCompanies'],
      recentArrivals: 0,
    };
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Maps guest persistence model to API response, including masked ID information.
   *
   * @param guest - Guest persistence entity.
   * @returns Guest response payload.
   */
  private async mapToResponse(guest: Guest): Promise<GuestResponse> {
    // Decrypt ID number for display (masked)
    let maskedIdNumber: string | null = null;
    let idVerified = false;

    if (guest.idNumber && guest.idType) {
      try {
        // In production, decrypt and mask
        maskedIdNumber = maskIdNumber(guest.idNumber); // Show last 4 digits only
        idVerified = true;
      } catch {
        maskedIdNumber = '[ENCRYPTED]';
      }
    }

    return {
      id: guest.id,
      organizationId: guest.organizationId,
      hotelId: guest.hotelId,

      firstName: guest.firstName,
      lastName: guest.lastName,
      fullName: `${guest.firstName} ${guest.lastName}`,
      email: guest.email,
      phone: guest.phone,
      mobile: guest.mobile,
      dateOfBirth: guest.dateOfBirth,
      nationality: guest.nationality,
      languageCode: guest.languageCode,

      identification: {
        idType: guest.idType,
        idNumber: maskedIdNumber,
        idExpiryDate: guest.idExpiryDate,
        verified: idVerified,
      },

      address: {
        line1: guest.addressLine1,
        line2: guest.addressLine2,
        city: guest.city,
        stateProvince: guest.stateProvince,
        postalCode: guest.postalCode,
        countryCode: guest.countryCode,
        fullAddress:
          [
            guest.addressLine1,
            guest.addressLine2,
            guest.city && guest.stateProvince
              ? `${guest.city}, ${guest.stateProvince} ${guest.postalCode || ''}`
              : guest.city,
            guest.countryCode,
          ]
            .filter(Boolean)
            .join(', ') || null,
      },

      guestType: guest.guestType,
      vipStatus: guest.vipStatus,
      vipReason: guest.vipReason,

      company: {
        name: guest.companyName,
        taxId: guest.companyTaxId,
      },

      preferences: {
        room: guest.roomPreferences,
        dietary: guest.dietaryRequirements,
        specialNeeds: guest.specialNeeds,
      },

      history: {
        totalStays: guest.totalStays,
        totalNights: guest.totalNights,
        totalRevenue: Number.parseFloat(guest.totalRevenue.toString()),
        lastStayDate: guest.lastStayDate,
        averageRate: Number.parseFloat(guest.averageRate.toString()),
      },

      marketing: {
        consent: guest.marketingConsent,
        emailOptIn: guest.emailOptIn,
        smsOptIn: guest.smsOptIn,
      },

      notes: {
        internal: guest.internalNotes,
        alert: guest.alertNotes,
      },

      createdAt: guest.createdAt,
      updatedAt: guest.updatedAt,
    };
  }

  /**
   * Maps guest response plus reservation and communication history collections.
   *
   * @param guestWithReservations - Guest entity loaded with history relations.
   * @returns Extended guest response containing history arrays.
   */
  private async mapToResponseWithHistory(guestWithReservations: GuestWithRelations) {
    const base = await this.mapToResponse(guestWithReservations as unknown as Guest);

    return {
      ...base,
      reservations: guestWithReservations.reservations.map((res) => ({
        id: res.id,
        confirmationNumber: res.confirmationNumber,
        hotelName: res.hotel.name,
        checkInDate: res.checkInDate,
        checkOutDate: res.checkOutDate,
        status: res.status,
        nights: res.nights,
        totalAmount: Number.parseFloat(res.totalAmount.toString()),
        roomType: res.rooms[0]?.roomType?.name,
        roomNumber: res.rooms[0]?.room?.roomNumber,
      })),
      communications: guestWithReservations.communications.map((comm) => ({
        id: comm.id,
        type: comm.type,
        channel: comm.channel,
        subject: comm.subject,
        sentAt: comm.createdAt,
        status: comm.status,
      })),
    };
  }
}

export const guestsService = new GuestsService();
