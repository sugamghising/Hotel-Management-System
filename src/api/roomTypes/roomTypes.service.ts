import type { Prisma } from '@/generated/prisma';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnprocessableEntityError,
  logger,
} from '../../core';
import { type HotelRepository, hotelRepository } from '../hotel';
import type {
  CreateRoomTypeInput,
  InventoryCalendarResponse,
  RoomTypeInventoryBulkInput,
  RoomTypeInventoryInput,
  RoomTypeListResponse,
  UpdateRoomTypeInput,
} from './roomTypes.dto';
import { type RoomTypesRepository, roomTypesRepository } from './roomTypes.repository';
import type {
  RoomType,
  RoomTypeImage,
  RoomTypeInventoryInput as RoomTypeInventoryInputInterface,
  RoomTypeQueryFilters,
  RoomTypeResponse,
} from './roomTypes.types';

export class RoomTypesService {
  private roomTypesRepo: RoomTypesRepository;
  private hotelRepo: HotelRepository;

  /**
   * Creates a room type service with repository dependencies.
   *
   * @param roomTypesRepo - Repository used for room type persistence and inventory data.
   * @param hotelRepo - Repository used to validate hotel ownership boundaries.
   */
  constructor(
    roomTypesRepo: RoomTypesRepository = roomTypesRepository,
    hotelRepo: HotelRepository = hotelRepository
  ) {
    this.roomTypesRepo = roomTypesRepo;
    this.hotelRepo = hotelRepo;
  }

  // ============================================================================
  // CREATE
  // ============================================================================

  /**
   * Creates a room type for a hotel after validating access, uniqueness, and image metadata.
   *
   * @param organizationId - Organization UUID that owns the hotel.
   * @param hotelId - Hotel UUID where the room type is created.
   * @param input - Room type configuration (capacity, amenities, media, and settings).
   * @param _createdBy - Optional actor identifier reserved for audit integration.
   * @returns Newly created room type mapped to the API response contract.
   * @throws {NotFoundError} When the hotel is not found in organization scope.
   * @throws {ConflictError} When the room type code already exists in the hotel.
   */
  async create(
    organizationId: string,
    hotelId: string,
    input: CreateRoomTypeInput,
    _createdBy?: string
  ): Promise<RoomTypeResponse> {
    // Verify hotel access
    await this.verifyHotelAccess(organizationId, hotelId);

    // Check code uniqueness
    const existing = await this.roomTypesRepo.findByCode(hotelId, input.code);
    if (existing) {
      throw new ConflictError(`Room type code '${input.code}' already exists in this hotel`);
    }

    // Validate image orders
    const images = this.processImages(
      (input.images || []) as Array<{
        url: string;
        caption?: string;
        order?: number;
        isPrimary?: boolean;
      }>
    );

    const roomType = await this.roomTypesRepo.create({
      organization: {
        connect: { id: organizationId },
      },
      hotel: {
        connect: { id: hotelId },
      },
      code: input.code.toUpperCase(),
      name: input.name,
      description: input.description || null,
      baseOccupancy: input.baseOccupancy || 2,
      maxOccupancy: input.maxOccupancy,
      maxAdults: input.maxAdults || 2,
      maxChildren: input.maxChildren || 0,
      sizeSqm: input.sizeSqm || null,
      sizeSqft: input.sizeSqft || null,
      bedTypes: input.bedTypes,
      amenities: input.amenities || [],
      viewType: input.viewType || null,
      defaultCleaningTime: input.defaultCleaningTime || 30,
      images: images as unknown as Prisma.InputJsonValue[],
      isActive: input.isActive ?? true,
      isBookable: input.isBookable ?? true,
      displayOrder: input.displayOrder || 0,
    });

    logger.info(`Room type created: ${roomType.name} (${roomType.code})`, {
      roomTypeId: roomType.id,
      hotelId,
    });

    return this.mapToResponse(roomType);
  }

  // ============================================================================
  // READ
  // ============================================================================

  /**
   * Retrieves a room type by ID and optionally attaches room-count statistics.
   *
   * @param id - Room type UUID.
   * @param organizationId - Organization UUID used for ownership enforcement.
   * @param includeStats - When `true`, includes total/available/occupied/OOO room counts.
   * @returns Room type details in response format.
   * @throws {NotFoundError} When the room type does not exist or is soft-deleted.
   * @throws {ForbiddenError} When the room type belongs to another organization.
   */
  async findById(
    id: string,
    organizationId: string,
    includeStats: boolean = false
  ): Promise<RoomTypeResponse> {
    const roomType = await this.roomTypesRepo.findById(id);

    if (!roomType || roomType.deletedAt) {
      throw new NotFoundError(`Room type not found: ${id}`);
    }

    if (roomType.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied to this room type');
    }

    let stats: { total: number; available: number; occupied: number; ooo: number } | undefined;
    if (includeStats) {
      stats = await this.roomTypesRepo.getRoomCounts(id);
    }

    return this.mapToResponse(roomType, stats);
  }

  /**
   * Lists room types for a hotel with optional filters and pagination metadata.
   *
   * Fetches room types first, then enriches each item with current room-count statistics.
   *
   * @param hotelId - Hotel UUID whose room types are requested.
   * @param organizationId - Organization UUID used for hotel scope validation.
   * @param filters - Optional search and state filters.
   * @param pagination - Page and limit values for response slicing.
   * @returns Paginated room type summaries with capacity, settings, and basic stats.
   * @throws {NotFoundError} When the hotel does not exist in organization scope.
   * @remarks Complexity: O(T) service mapping plus one stats query per returned room type.
   */
  async findByHotel(
    hotelId: string,
    organizationId: string,
    filters: RoomTypeQueryFilters = {},
    pagination: { page: number; limit: number } = { page: 1, limit: 20 }
  ): Promise<RoomTypeListResponse> {
    // Verify hotel access
    await this.verifyHotelAccess(organizationId, hotelId);

    const { roomTypes, total } = await this.roomTypesRepo.findByHotel(hotelId, filters, pagination);

    // Get stats for each room type
    const roomTypesWithStats = await Promise.all(
      roomTypes.map(async (rt) => {
        const counts = await this.roomTypesRepo.getRoomCounts(rt.id);
        return {
          id: rt.id,
          code: rt.code,
          name: rt.name,
          capacity: {
            baseOccupancy: rt.baseOccupancy,
            maxOccupancy: rt.maxOccupancy,
          },
          features: {
            amenities: rt.amenities,
            viewType: rt.viewType,
          },
          settings: {
            isActive: rt.isActive,
            isBookable: rt.isBookable,
            displayOrder: rt.displayOrder,
          },
          stats: {
            totalRooms: counts.total,
            availableToday: counts.available,
          },
        };
      })
    );

    return {
      roomTypes: roomTypesWithStats,
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
   * Updates room type attributes while enforcing organization scope.
   *
   * @param id - Room type UUID.
   * @param organizationId - Organization UUID used for authorization.
   * @param input - Partial room type fields to modify.
   * @param _updatedBy - Optional actor identifier reserved for audit integration.
   * @returns Updated room type mapped to response format.
   * @throws {NotFoundError} When the room type does not exist.
   * @throws {ForbiddenError} When the room type is outside organization scope.
   */
  async update(
    id: string,
    organizationId: string,
    input: UpdateRoomTypeInput,
    _updatedBy?: string
  ): Promise<RoomTypeResponse> {
    const roomType = await this.roomTypesRepo.findById(id);

    if (!roomType || roomType.deletedAt) {
      throw new NotFoundError(`Room type not found: ${id}`);
    }

    if (roomType.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied to this room type');
    }

    // If changing capacity, validate against existing rooms
    if (input.maxOccupancy !== undefined || input.maxAdults !== undefined) {
      const hasRooms = await this.roomTypesRepo.hasRooms(id);
      if (hasRooms) {
        // Check existing reservations wouldn't violate new limits
        // This is a simplified check - full implementation would check active reservations
        logger.warn(`Capacity changed for room type with existing rooms: ${id}`);
      }
    }

    const updated = await this.roomTypesRepo.update(id, {
      ...(input as unknown as Prisma.RoomTypeUpdateInput),
      updatedAt: new Date(),
    });

    logger.info(`Room type updated: ${updated.name}`, { roomTypeId: id });

    return this.mapToResponse(updated);
  }

  // ============================================================================
  // DELETE
  // ============================================================================

  /**
   * Soft-deletes a room type after validating reservation and room dependencies.
   *
   * @param id - Room type UUID.
   * @param organizationId - Organization UUID used for ownership checks.
   * @param deletedBy - Optional actor identifier for audit logs.
   * @returns Resolves when the soft-delete is persisted.
   * @throws {NotFoundError} When the room type does not exist.
   * @throws {ForbiddenError} When the room type belongs to another organization.
   * @throws {UnprocessableEntityError} When active reservations or rooms still reference the type.
   */
  async delete(id: string, organizationId: string, deletedBy?: string): Promise<void> {
    const roomType = await this.roomTypesRepo.findById(id);

    if (!roomType || roomType.deletedAt) {
      throw new NotFoundError(`Room type not found: ${id}`);
    }

    if (roomType.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied to this room type');
    }

    // Check for active reservations
    const hasReservations = await this.roomTypesRepo.hasActiveReservations(id);
    if (hasReservations) {
      throw new UnprocessableEntityError(
        'Cannot delete room type with active or future reservations. ' +
          'Please cancel or move all reservations first.'
      );
    }

    // Check for rooms
    const hasRooms = await this.roomTypesRepo.hasRooms(id);
    if (hasRooms) {
      throw new UnprocessableEntityError(
        'Cannot delete room type with associated rooms. ' +
          'Please reassign or delete all rooms first.'
      );
    }

    await this.roomTypesRepo.softDelete(id);

    logger.warn(`Room type deleted: ${roomType.name}`, {
      roomTypeId: id,
      deletedBy,
    });
  }

  // ============================================================================
  // IMAGES
  // ============================================================================

  /**
   * Appends an image to a room type media gallery.
   *
   * @param id - Room type UUID.
   * @param organizationId - Organization UUID used for ownership validation.
   * @param image - Image payload containing URL and optional caption/order/primary flags.
   * @returns Updated room type response with refreshed media data.
   * @throws {NotFoundError} When the room type does not exist.
   * @throws {ForbiddenError} When the room type belongs to another organization.
   */
  async addImage(
    id: string,
    organizationId: string,
    image: {
      url: string;
      caption?: string;
      order?: number;
      isPrimary?: boolean;
    }
  ): Promise<RoomTypeResponse> {
    const roomType = await this.roomTypesRepo.findById(id);

    if (!roomType || roomType.deletedAt) {
      throw new NotFoundError(`Room type not found: ${id}`);
    }

    if (roomType.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied');
    }

    const processedImage: RoomTypeImage = {
      url: image.url,
      caption: image.caption || null,
      order: image.order ?? (roomType.images as unknown as RoomTypeImage[]).length,
      isPrimary: image.isPrimary || false,
    };

    const updated = await this.roomTypesRepo.addImage(id, processedImage);

    return this.mapToResponse(updated);
  }

  /**
   * Removes an image from a room type gallery by URL.
   *
   * @param id - Room type UUID.
   * @param organizationId - Organization UUID used for ownership validation.
   * @param imageUrl - Exact image URL to remove.
   * @returns Updated room type response after image removal.
   * @throws {NotFoundError} When the room type does not exist.
   * @throws {ForbiddenError} When the room type belongs to another organization.
   */
  async removeImage(
    id: string,
    organizationId: string,
    imageUrl: string
  ): Promise<RoomTypeResponse> {
    const roomType = await this.roomTypesRepo.findById(id);

    if (!roomType || roomType.deletedAt) {
      throw new NotFoundError(`Room type not found: ${id}`);
    }

    if (roomType.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied');
    }

    const updated = await this.roomTypesRepo.removeImage(id, imageUrl);

    return this.mapToResponse(updated);
  }

  /**
   * Reorders room type gallery images according to provided URL/order pairs.
   *
   * @param id - Room type UUID.
   * @param organizationId - Organization UUID used for ownership validation.
   * @param imageOrders - Ordered image descriptors keyed by URL.
   * @returns Updated room type response with reordered media.
   * @throws {NotFoundError} When the room type does not exist.
   * @throws {ForbiddenError} When the room type belongs to another organization.
   */
  async reorderImages(
    id: string,
    organizationId: string,
    imageOrders: { url: string; order: number }[]
  ): Promise<RoomTypeResponse> {
    const roomType = await this.roomTypesRepo.findById(id);

    if (!roomType || roomType.deletedAt) {
      throw new NotFoundError(`Room type not found: ${id}`);
    }

    if (roomType.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied');
    }

    const updated = await this.roomTypesRepo.reorderImages(id, imageOrders);

    return this.mapToResponse(updated);
  }

  // ============================================================================
  // INVENTORY MANAGEMENT
  // ============================================================================

  /**
   * Returns a room type inventory calendar for an inclusive date range.
   *
   * @param roomTypeId - Room type UUID whose inventory is queried.
   * @param organizationId - Organization UUID used for authorization.
   * @param startDate - Inclusive inventory start date.
   * @param endDate - Inclusive inventory end date.
   * @returns Calendar rows with availability and restriction fields per business date.
   * @throws {NotFoundError} When the room type does not exist.
   * @throws {ForbiddenError} When the room type belongs to another organization.
   */
  async getInventory(
    roomTypeId: string,
    organizationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<InventoryCalendarResponse> {
    const roomType = await this.roomTypesRepo.findById(roomTypeId);

    if (!roomType || roomType.deletedAt) {
      throw new NotFoundError(`Room type not found: ${roomTypeId}`);
    }

    if (roomType.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied');
    }

    const inventory = await this.roomTypesRepo.getInventory(roomTypeId, startDate, endDate);

    return {
      roomTypeId,
      roomTypeCode: roomType.code,
      roomTypeName: roomType.name,
      dates: inventory.map((inv: Prisma.RoomInventoryGetPayload<object>) => {
        const dateStr = (
          inv.date instanceof Date
            ? inv.date.toISOString().split('T')[0]
            : inv.date
              ? String(inv.date)
              : ''
        ) as string;
        return {
          date: dateStr,
          totalRooms: inv.totalRooms,
          sold: inv.sold,
          available: inv.available,
          outOfOrder: inv.outOfOrder,
          blocked: inv.blocked,
          stopSell: inv.stopSell,
          minStay: inv.minStay,
          maxStay: inv.maxStay,
          closedToArrival: inv.closedToArrival,
          closedToDeparture: inv.closedToDeparture,
          rateOverride: inv.rateOverride ? Number(inv.rateOverride) : null,
        };
      }),
    };
  }

  /**
   * Upserts one room inventory day for a room type.
   *
   * @param roomTypeId - Room type UUID.
   * @param organizationId - Organization UUID used for ownership checks.
   * @param input - Date-level inventory and restriction values to persist.
   * @returns Upserted inventory record.
   * @throws {NotFoundError} When the room type does not exist.
   * @throws {ForbiddenError} When the room type belongs to another organization.
   */
  async updateInventory(
    roomTypeId: string,
    organizationId: string,
    input: RoomTypeInventoryInput
  ): Promise<Prisma.RoomInventoryGetPayload<object>> {
    const roomType = await this.roomTypesRepo.findById(roomTypeId);

    if (!roomType || roomType.deletedAt) {
      throw new NotFoundError(`Room type not found: ${roomTypeId}`);
    }

    if (roomType.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied');
    }

    const inventory = await this.roomTypesRepo.upsertInventory(
      roomTypeId,
      input as unknown as RoomTypeInventoryInputInterface
    );

    return inventory;
  }

  /**
   * Applies partial inventory updates across a date range for a room type.
   *
   * Undefined update fields are removed before delegation so only explicit values are written.
   *
   * @param roomTypeId - Room type UUID.
   * @param organizationId - Organization UUID used for ownership checks.
   * @param input - Range, optional weekday filter, and partial inventory updates.
   * @returns Number of dates updated.
   * @throws {NotFoundError} When the room type does not exist.
   * @throws {ForbiddenError} When the room type belongs to another organization.
   * @remarks Complexity: O(D) where `D` is matched dates in the requested range.
   */
  async bulkUpdateInventory(
    roomTypeId: string,
    organizationId: string,
    input: RoomTypeInventoryBulkInput
  ): Promise<{ updatedCount: number }> {
    const roomType = await this.roomTypesRepo.findById(roomTypeId);

    if (!roomType || roomType.deletedAt) {
      throw new NotFoundError(`Room type not found: ${roomTypeId}`);
    }

    if (roomType.organizationId !== organizationId) {
      throw new ForbiddenError('Access denied');
    }

    // Filter out undefined values to comply with exactOptionalPropertyTypes
    const updates: Partial<RoomTypeInventoryInput> = {};
    if (input.updates.totalRooms !== undefined) updates.totalRooms = input.updates.totalRooms;
    if (input.updates.outOfOrder !== undefined) updates.outOfOrder = input.updates.outOfOrder;
    if (input.updates.blocked !== undefined) updates.blocked = input.updates.blocked;
    if (input.updates.overbookingLimit !== undefined)
      updates.overbookingLimit = input.updates.overbookingLimit;
    if (input.updates.stopSell !== undefined) updates.stopSell = input.updates.stopSell;
    if (input.updates.minStay !== undefined) updates.minStay = input.updates.minStay;
    if (input.updates.maxStay !== undefined) updates.maxStay = input.updates.maxStay;
    if (input.updates.closedToArrival !== undefined)
      updates.closedToArrival = input.updates.closedToArrival;
    if (input.updates.closedToDeparture !== undefined)
      updates.closedToDeparture = input.updates.closedToDeparture;
    if (input.updates.rateOverride !== undefined) updates.rateOverride = input.updates.rateOverride;
    if (input.updates.reason !== undefined) updates.reason = input.updates.reason;

    const updatedCount = await this.roomTypesRepo.bulkUpdateInventory(
      roomTypeId,
      input.startDate,
      input.endDate,
      updates as unknown as Partial<RoomTypeInventoryInputInterface>,
      input.daysOfWeek
    );

    logger.info(`Bulk inventory update: ${updatedCount} days`, {
      roomTypeId,
      startDate: input.startDate,
      endDate: input.endDate,
    });

    return { updatedCount };
  }

  // ============================================================================
  // AVAILABILITY CHECK (for booking engine)
  // ============================================================================

  /**
   * Evaluates whether a room type is bookable for the requested stay and guest count.
   *
   * It short-circuits on non-bookable types or capacity overflow, then checks per-night inventory
   * and aggregates restrictive flags (`minStay`, `maxStay`, `closedToArrival`) across the stay.
   *
   * @param roomTypeId - Room type UUID being priced/checked.
   * @param checkIn - Arrival date.
   * @param checkOut - Departure date.
   * @param guests - Requested occupancy split by adults and children.
   * @returns Availability result with restriction context and evaluated inventory rows.
   * @remarks Complexity: O(N) where `N` is nights between check-in and check-out.
   */
  async checkAvailability(
    roomTypeId: string,
    checkIn: Date,
    checkOut: Date,
    guests: { adults: number; children: number }
  ): Promise<{
    available: boolean;
    maxGuests: number;
    inventory: Prisma.RoomInventoryGetPayload<object>[];
    restrictions: {
      minStay: number | null;
      maxStay: number | null;
      closedToArrival: boolean;
    };
  }> {
    const roomType = await this.roomTypesRepo.findById(roomTypeId);

    if (!roomType || !roomType.isBookable) {
      return {
        available: false,
        maxGuests: 0,
        inventory: [],
        restrictions: { minStay: null, maxStay: null, closedToArrival: false },
      };
    }

    // Check guest capacity
    const totalGuests = guests.adults + guests.children;
    if (totalGuests > roomType.maxOccupancy) {
      return {
        available: false,
        maxGuests: roomType.maxOccupancy,
        inventory: [],
        restrictions: { minStay: null, maxStay: null, closedToArrival: false },
      };
    }

    // Get inventory for date range
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

    const inventory = await this.roomTypesRepo.getInventory(
      roomTypeId,
      checkIn,
      new Date(checkOut.getTime() - 1) // Check day before checkout
    );

    // Check availability for each night
    let minStay: number | null = null;
    let maxStay: number | null = null;
    let closedToArrival = false;

    for (const inv of inventory) {
      if (inv.available <= 0 || inv.stopSell) {
        return {
          available: false,
          maxGuests: roomType.maxOccupancy,
          inventory: [],
          restrictions: { minStay: null, maxStay: null, closedToArrival: false },
        };
      }

      // Aggregate restrictions
      if (inv.minStay && (!minStay || inv.minStay > minStay)) {
        minStay = inv.minStay;
      }
      if (inv.maxStay && (!maxStay || inv.maxStay < maxStay)) {
        maxStay = inv.maxStay;
      }
      if (inv.closedToArrival && inv.date.toDateString() === checkIn.toDateString()) {
        closedToArrival = true;
      }
    }

    // Check stay length restrictions
    if (minStay && nights < minStay) {
      return {
        available: false,
        maxGuests: roomType.maxOccupancy,
        inventory: [],
        restrictions: { minStay, maxStay, closedToArrival },
      };
    }

    if (maxStay && nights > maxStay) {
      return {
        available: false,
        maxGuests: roomType.maxOccupancy,
        inventory: [],
        restrictions: { minStay, maxStay, closedToArrival },
      };
    }

    return {
      available: true,
      maxGuests: roomType.maxOccupancy,
      inventory,
      restrictions: { minStay, maxStay, closedToArrival },
    };
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Verifies that the given hotel belongs to the organization.
   *
   * @param organizationId - Organization UUID.
   * @param hotelId - Hotel UUID.
   * @returns Resolves when the hotel exists in organization scope.
   * @throws {NotFoundError} When the hotel is not found.
   */
  private async verifyHotelAccess(organizationId: string, hotelId: string): Promise<void> {
    const exists = await this.hotelRepo.existsInOrganization(organizationId, hotelId);
    if (!exists) {
      throw new NotFoundError(`Hotel not found: ${hotelId}`);
    }
  }

  /**
   * Normalizes room type image input and enforces primary/order defaults.
   *
   * Ensures at least one image is marked as primary and fills missing `order` values by index.
   *
   * @param images - Raw image payload received from API input.
   * @returns Sanitized image objects ready for persistence.
   */
  private processImages(
    images: Array<{ url: string; caption?: string; order?: number; isPrimary?: boolean }>
  ): RoomTypeImage[] {
    if (images.length === 0) return [];

    // Ensure at least one primary
    const hasPrimary = images.some((img) => img.isPrimary);
    if (!hasPrimary) {
      const firstImage = images[0];
      if (firstImage) {
        firstImage.isPrimary = true;
      }
    }

    // Ensure unique orders
    return images.map((img, index) => ({
      url: img.url,
      caption: img.caption || null,
      order: img.order ?? index,
      isPrimary: img.isPrimary || false,
    }));
  }

  /**
   * Maps a room type entity to the API response contract, optionally adding aggregate stats.
   *
   * @param roomType - Persisted room type entity.
   * @param stats - Optional computed room counts for this room type.
   * @returns Room type response grouped by capacity, physical, media, and settings sections.
   */
  private mapToResponse(
    roomType: RoomType,
    stats?: { total: number; available: number; occupied: number; ooo: number }
  ): RoomTypeResponse {
    const images = (roomType.images as unknown as RoomTypeImage[]) || [];
    const primaryImage = images.find((img) => img.isPrimary) || images[0] || null;

    return {
      id: roomType.id,
      organizationId: roomType.organizationId,
      hotelId: roomType.hotelId,

      code: roomType.code,
      name: roomType.name,
      description: roomType.description,

      capacity: {
        baseOccupancy: roomType.baseOccupancy,
        maxOccupancy: roomType.maxOccupancy,
        maxAdults: roomType.maxAdults,
        maxChildren: roomType.maxChildren,
      },

      physical: {
        sizeSqm: roomType.sizeSqm,
        sizeSqft: roomType.sizeSqft,
        bedTypes: roomType.bedTypes,
      },

      features: {
        amenities: roomType.amenities,
        viewType: roomType.viewType,
      },

      housekeeping: {
        defaultCleaningTime: roomType.defaultCleaningTime,
      },

      media: {
        images,
        primaryImage,
      },

      settings: {
        isActive: roomType.isActive,
        isBookable: roomType.isBookable,
        displayOrder: roomType.displayOrder,
      },

      ...(stats && {
        stats: {
          totalRooms: stats.total,
          availableRooms: stats.available,
          occupiedRooms: stats.occupied,
          oooRooms: stats.ooo,
          averageRate: null, // Would come from rate plans
        },
      }),

      createdAt: roomType.createdAt,
      updatedAt: roomType.updatedAt,
    };
  }
}

export const roomTypesService = new RoomTypesService();
