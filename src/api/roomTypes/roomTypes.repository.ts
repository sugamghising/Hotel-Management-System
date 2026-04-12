// src/api/roomTypes/roomTypes.repository.ts

import { prisma } from '../../database/prisma';
import type { Prisma } from '../../generated/prisma';
import type { RoomType, RoomTypeImage, RoomTypeInventoryInput } from './roomTypes.types';

export type RoomTypeWhereInput = Prisma.RoomTypeWhereInput;
export type RoomTypeCreateInput = Prisma.RoomTypeCreateInput;
export type RoomTypeUpdateInput = Prisma.RoomTypeUpdateInput;

export class RoomTypesRepository {
  // ============================================================================
  // CRUD OPERATIONS
  // ============================================================================

  /**
   * Retrieves a room type by UUID with optional relation expansion.
   *
   * @param id - Room type UUID.
   * @param include - Optional Prisma include graph.
   * @returns Matching room type or `null` when not found.
   */
  async findById(id: string, include?: Prisma.RoomTypeInclude): Promise<RoomType | null> {
    return prisma.roomType.findUnique({
      where: { id },
      ...(include && { include }),
    }) as Promise<RoomType | null>;
  }

  /**
   * Retrieves a room type by hotel and canonical uppercase code.
   *
   * @param hotelId - Hotel UUID that scopes room type codes.
   * @param code - Room type code; normalized to uppercase before lookup.
   * @returns Matching room type or `null`.
   */
  async findByCode(hotelId: string, code: string): Promise<RoomType | null> {
    return prisma.roomType.findUnique({
      where: {
        uq_roomtype_hotel_code: {
          hotelId,
          code: code.toUpperCase(),
        },
      },
    }) as Promise<RoomType | null>;
  }

  /**
   * Lists room types for a hotel with optional feature and lifecycle filters.
   *
   * Applies filter clauses for active/bookable flags, view type, and free-text search,
   * then executes list and count queries concurrently for stable pagination metadata.
   *
   * @param hotelId - Hotel UUID.
   * @param filters - Optional room type filters.
   * @param pagination - Optional pagination configuration.
   * @returns Paginated room type rows and total matches.
   * @remarks Complexity: O(R) for returned rows plus two DB queries (`findMany` + `count`).
   */
  async findByHotel(
    hotelId: string,
    filters?: {
      isActive?: boolean;
      isBookable?: boolean;
      viewType?: string;
      search?: string;
    },
    pagination?: { page: number; limit: number }
  ): Promise<{ roomTypes: RoomType[]; total: number }> {
    const where: Prisma.RoomTypeWhereInput = {
      hotelId,
      deletedAt: null,
    };

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters?.isBookable !== undefined) {
      where.isBookable = filters.isBookable;
    }

    if (filters?.viewType) {
      where.viewType = filters.viewType;
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { code: { contains: filters.search.toUpperCase() } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [roomTypes, total] = await Promise.all([
      prisma.roomType.findMany({
        where,
        ...(pagination && {
          skip: (pagination.page - 1) * pagination.limit,
          take: pagination.limit,
        }),
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      }),
      prisma.roomType.count({ where }),
    ]);

    return { roomTypes: roomTypes as unknown as RoomType[], total };
  }

  /**
   * Creates a room type.
   *
   * @param data - Prisma create payload.
   * @returns The created room type.
   */
  async create(data: RoomTypeCreateInput): Promise<RoomType> {
    return prisma.roomType.create({ data }) as unknown as Promise<RoomType>;
  }

  /**
   * Updates a room type by UUID.
   *
   * @param id - Room type UUID.
   * @param data - Prisma update payload.
   * @returns The updated room type.
   */
  async update(id: string, data: RoomTypeUpdateInput): Promise<RoomType> {
    return prisma.roomType.update({
      where: { id },
      data,
    }) as unknown as Promise<RoomType>;
  }

  /**
   * Soft-deletes a room type and disables booking usage flags.
   *
   * @param id - Room type UUID.
   * @returns Resolves when the soft-delete update is persisted.
   */
  async softDelete(id: string): Promise<void> {
    await prisma.roomType.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
        isBookable: false,
        updatedAt: new Date(),
      },
    });
  }

  // ============================================================================
  // IMAGES
  // ============================================================================

  /**
   * Appends an image to a room type image gallery and normalizes primary ordering.
   *
   * When `image.isPrimary` is `true`, existing images are demoted so only one primary
   * image remains. The resulting gallery is sorted by `order` before persistence.
   *
   * @param roomTypeId - Room type UUID.
   * @param image - Image payload to append.
   * @returns Updated room type containing the modified `images` JSON.
   * @throws {Error} When the room type does not exist.
   * @remarks Complexity: O(I log I) where `I` is image count due to remap and sort.
   */
  async addImage(roomTypeId: string, image: RoomTypeImage): Promise<RoomType> {
    const roomType = await prisma.roomType.findUnique({
      where: { id: roomTypeId },
    });

    if (!roomType) {
      throw new Error('Room type not found');
    }

    const currentImages = (roomType.images as Prisma.JsonValue[]) || [];

    // If new image is primary, unset others
    const updatedImages: Prisma.JsonValue[] = image.isPrimary
      ? currentImages.map((img: Prisma.JsonValue) => {
          const imgObj = img as unknown as RoomTypeImage;
          return { ...imgObj, isPrimary: false } as unknown as Prisma.JsonValue;
        })
      : [...currentImages];

    updatedImages.push(image as unknown as Prisma.JsonValue);

    // Sort by order
    updatedImages.sort((a: Prisma.JsonValue, b: Prisma.JsonValue) => {
      const aImg = a as unknown as RoomTypeImage;
      const bImg = b as unknown as RoomTypeImage;
      return aImg.order - bImg.order;
    });

    return prisma.roomType.update({
      where: { id: roomTypeId },
      data: {
        images: updatedImages as unknown as Prisma.InputJsonValue[],
        updatedAt: new Date(),
      },
    }) as unknown as Promise<RoomType>;
  }

  /**
   * Removes an image URL from a room type gallery and preserves a primary image.
   *
   * If the removed image was primary and images remain, the first remaining image is
   * promoted to primary so downstream UI always has a default hero image.
   *
   * @param roomTypeId - Room type UUID.
   * @param imageUrl - Exact URL to remove from the gallery.
   * @returns Updated room type containing the modified `images` JSON.
   * @throws {Error} When the room type does not exist.
   * @remarks Complexity: O(I) where `I` is image count.
   */
  async removeImage(roomTypeId: string, imageUrl: string): Promise<RoomType> {
    const roomType = await prisma.roomType.findUnique({
      where: { id: roomTypeId },
    });

    if (!roomType) {
      throw new Error('Room type not found');
    }

    const currentImages = (roomType.images as Prisma.JsonValue[]) || [];
    const updatedImages = currentImages.filter((img: Prisma.JsonValue) => {
      const imgObj = img as unknown as RoomTypeImage;
      return imgObj.url !== imageUrl;
    });

    // Ensure at least one primary if images remain
    if (
      updatedImages.length > 0 &&
      !updatedImages.some((img: Prisma.JsonValue) => (img as unknown as RoomTypeImage).isPrimary)
    ) {
      const firstImg = updatedImages[0] as unknown as RoomTypeImage;
      updatedImages[0] = { ...firstImg, isPrimary: true } as unknown as Prisma.JsonValue;
    }

    return prisma.roomType.update({
      where: { id: roomTypeId },
      data: {
        images: updatedImages as unknown as Prisma.InputJsonValue[],
        updatedAt: new Date(),
      },
    }) as unknown as Promise<RoomType>;
  }

  /**
   * Reassigns display order values for room type images.
   *
   * Only images whose URLs are present in `imageOrders` are modified; other images keep
   * their current order values. The result is re-sorted before persistence.
   *
   * @param roomTypeId - Room type UUID.
   * @param imageOrders - URL-to-order mapping updates.
   * @returns Updated room type containing reordered images.
   * @throws {Error} When the room type does not exist.
   * @remarks Complexity: O(I * O + I log I) where `I` is image count and `O` is order updates.
   */
  async reorderImages(
    roomTypeId: string,
    imageOrders: { url: string; order: number }[]
  ): Promise<RoomType> {
    const roomType = await prisma.roomType.findUnique({
      where: { id: roomTypeId },
    });

    if (!roomType) {
      throw new Error('Room type not found');
    }

    const currentImages = (roomType.images as Prisma.JsonValue[]) || [];

    const updatedImages = currentImages
      .map((img: Prisma.JsonValue) => {
        const imgObj = img as unknown as RoomTypeImage;
        const update = imageOrders.find((o) => o.url === imgObj.url);
        return update ? { ...imgObj, order: update.order } : img;
      })
      .sort((a: Prisma.JsonValue, b: Prisma.JsonValue) => {
        const aImg = a as unknown as RoomTypeImage;
        const bImg = b as unknown as RoomTypeImage;
        return aImg.order - bImg.order;
      });

    return prisma.roomType.update({
      where: { id: roomTypeId },
      data: {
        images: updatedImages as unknown as Prisma.InputJsonValue[],
        updatedAt: new Date(),
      },
    }) as unknown as Promise<RoomType>;
  }

  // ============================================================================
  // INVENTORY MANAGEMENT
  // ============================================================================

  /**
   * Retrieves inventory rows for a room type across an inclusive date range.
   *
   * @param roomTypeId - Room type UUID.
   * @param startDate - Inclusive range start date.
   * @param endDate - Inclusive range end date.
   * @returns Inventory rows ordered by date ascending.
   */
  async getInventory(
    roomTypeId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Prisma.RoomInventoryGetPayload<object>[]> {
    return prisma.roomInventory.findMany({
      where: {
        roomTypeId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: 'asc' },
    });
  }

  /**
   * Creates or updates one inventory day and recalculates availability.
   *
   * The date is normalized to local midnight before use in the unique key.
   * Availability is recomputed as `totalRooms - outOfOrder - blocked - sold + overbookingLimit`
   * and then clamped to zero to avoid negative sellable inventory.
   *
   * @param roomTypeId - Room type UUID.
   * @param input - Inventory update payload for one business date.
   * @returns The upserted inventory row.
   * @remarks Complexity: O(1) application work plus two DB lookups (`count` for defaults and sold count).
   */
  async upsertInventory(
    roomTypeId: string,
    input: RoomTypeInventoryInput
  ): Promise<Prisma.RoomInventoryGetPayload<object>> {
    const date = new Date(input.date);
    date.setHours(0, 0, 0, 0);

    // Calculate available
    const totalRooms =
      input.totalRooms !== undefined
        ? input.totalRooms
        : await this.getDefaultTotalRooms(roomTypeId);
    const outOfOrder = input.outOfOrder || 0;
    const blocked = input.blocked || 0;
    const sold = await this.getSoldCount(roomTypeId, date);
    const available = totalRooms - outOfOrder - blocked - sold + (input.overbookingLimit || 0);

    return prisma.roomInventory.upsert({
      where: {
        uq_inventory_roomtype_date: {
          roomTypeId,
          date,
        },
      },
      create: {
        roomTypeId,
        date,
        totalRooms,
        outOfOrder,
        blocked,
        sold,
        available: Math.max(0, available),
        overbookingLimit: input.overbookingLimit || 0,
        stopSell: input.stopSell || false,
        minStay: input.minStay || null,
        maxStay: input.maxStay || null,
        closedToArrival: input.closedToArrival || false,
        closedToDeparture: input.closedToDeparture || false,
        rateOverride: input.rateOverride || null,
        reason: input.reason || null,
      },
      update: {
        ...(input.totalRooms !== undefined && { totalRooms }),
        outOfOrder,
        blocked,
        available: Math.max(0, available),
        ...(input.overbookingLimit !== undefined && { overbookingLimit: input.overbookingLimit }),
        ...(input.stopSell !== undefined && { stopSell: input.stopSell }),
        ...(input.minStay !== undefined && { minStay: input.minStay }),
        ...(input.maxStay !== undefined && { maxStay: input.maxStay }),
        ...(input.closedToArrival !== undefined && { closedToArrival: input.closedToArrival }),
        ...(input.closedToDeparture !== undefined && {
          closedToDeparture: input.closedToDeparture,
        }),
        ...(input.rateOverride !== undefined && { rateOverride: input.rateOverride }),
        ...(input.reason !== undefined && { reason: input.reason }),
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Applies the same inventory updates to each selected day in a date window.
   *
   * Generates a date list from `startDate` through `endDate` (inclusive), optionally
   * filtered by `daysOfWeek`, then upserts each day inside one transaction.
   *
   * @param roomTypeId - Room type UUID.
   * @param startDate - Inclusive window start date.
   * @param endDate - Inclusive window end date.
   * @param updates - Partial inventory fields to apply.
   * @param daysOfWeek - Optional weekday filter (`0` Sunday through `6` Saturday).
   * @returns Number of upsert operations executed.
   * @remarks Complexity: O(D) application work and O(D) DB writes, where `D` is selected days.
   */
  async bulkUpdateInventory(
    roomTypeId: string,
    startDate: Date,
    endDate: Date,
    updates: Partial<RoomTypeInventoryInput>,
    daysOfWeek?: number[]
  ): Promise<number> {
    const dates: Date[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const dayOfWeek = current.getDay(); // 0 = Sunday

      if (!daysOfWeek || daysOfWeek.includes(dayOfWeek)) {
        dates.push(new Date(current));
      }

      current.setDate(current.getDate() + 1);
    }

    // Use transaction for bulk update
    const operations = dates.map((date) =>
      prisma.roomInventory.upsert({
        where: {
          uq_inventory_roomtype_date: {
            roomTypeId,
            date,
          },
        },
        create: {
          roomTypeId,
          date,
          totalRooms: updates.totalRooms || 0,
          outOfOrder: updates.outOfOrder || 0,
          blocked: updates.blocked || 0,
          sold: 0,
          available: (updates.totalRooms || 0) - (updates.outOfOrder || 0) - (updates.blocked || 0),
          overbookingLimit: updates.overbookingLimit || 0,
          stopSell: updates.stopSell || false,
          minStay: updates.minStay || null,
          maxStay: updates.maxStay || null,
          closedToArrival: updates.closedToArrival || false,
          closedToDeparture: updates.closedToDeparture || false,
          rateOverride: updates.rateOverride || null,
          reason: updates.reason || null,
        },
        update: {
          ...(updates.totalRooms !== undefined && { totalRooms: updates.totalRooms }),
          ...(updates.outOfOrder !== undefined && { outOfOrder: updates.outOfOrder }),
          ...(updates.blocked !== undefined && { blocked: updates.blocked }),
          ...(updates.overbookingLimit !== undefined && {
            overbookingLimit: updates.overbookingLimit,
          }),
          ...(updates.stopSell !== undefined && { stopSell: updates.stopSell }),
          ...(updates.minStay !== undefined && { minStay: updates.minStay }),
          ...(updates.maxStay !== undefined && { maxStay: updates.maxStay }),
          ...(updates.closedToArrival !== undefined && {
            closedToArrival: updates.closedToArrival,
          }),
          ...(updates.closedToDeparture !== undefined && {
            closedToDeparture: updates.closedToDeparture,
          }),
          ...(updates.rateOverride !== undefined && { rateOverride: updates.rateOverride }),
          ...(updates.reason !== undefined && { reason: updates.reason }),
          updatedAt: new Date(),
        },
      })
    );

    const results = await prisma.$transaction(operations);

    return results.length;
  }

  /**
   * Retrieves a room type inventory row for a date, creating defaults if missing.
   *
   * Missing rows are initialized with current room count, zero sold/out-of-order/blocked,
   * and unrestricted sales flags (`stopSell`, closed-to-arrival/departure set to `false`).
   *
   * @param roomTypeId - Room type UUID.
   * @param date - Business date to fetch or initialize.
   * @returns Existing inventory row or a newly created default row.
   */
  async getOrCreateInventory(
    roomTypeId: string,
    date: Date
  ): Promise<Prisma.RoomInventoryGetPayload<object>> {
    const existing = await prisma.roomInventory.findUnique({
      where: {
        uq_inventory_roomtype_date: {
          roomTypeId,
          date: new Date(date.setHours(0, 0, 0, 0)),
        },
      },
    });

    if (existing) return existing;

    // Create default inventory
    const totalRooms = await this.getDefaultTotalRooms(roomTypeId);

    return prisma.roomInventory.create({
      data: {
        roomTypeId,
        date: new Date(date.setHours(0, 0, 0, 0)),
        totalRooms,
        outOfOrder: 0,
        blocked: 0,
        sold: 0,
        available: totalRooms,
        overbookingLimit: 0,
        stopSell: false,
        closedToArrival: false,
        closedToDeparture: false,
      },
    });
  }

  // ============================================================================
  // STATS & COUNTS
  // ============================================================================

  /**
   * Aggregates room operational counts for a room type.
   *
   * @param roomTypeId - Room type UUID.
   * @returns Total, available, occupied, and out-of-order room counts.
   */
  async getRoomCounts(roomTypeId: string): Promise<{
    total: number;
    available: number;
    occupied: number;
    ooo: number;
  }> {
    const results = await prisma.room.groupBy({
      by: ['status'],
      where: {
        roomTypeId,
        deletedAt: null,
      },
      _count: {
        status: true,
      },
    });

    const counts = results.reduce(
      (acc, curr) => {
        acc[curr.status] = curr._count.status;
        return acc;
      },
      {} as Record<string, number>
    );

    const occupied =
      (counts['OCCUPIED_CLEAN'] || 0) +
      (counts['OCCUPIED_DIRTY'] || 0) +
      (counts['OCCUPIED_CLEANING'] || 0);

    return {
      total: Object.values(counts).reduce((a, b) => a + b, 0),
      available: (counts['VACANT_CLEAN'] || 0) + (counts['VACANT_DIRTY'] || 0),
      occupied,
      ooo: counts['OUT_OF_ORDER'] || 0,
    };
  }

  /**
   * Counts active physical rooms linked to a room type.
   *
   * @param roomTypeId - Room type UUID.
   * @returns Number of non-deleted rooms.
   */
  async getDefaultTotalRooms(roomTypeId: string): Promise<number> {
    return prisma.room.count({
      where: {
        roomTypeId,
        deletedAt: null,
      },
    });
  }

  /**
   * Counts sold rooms for one room type on a specific business date.
   *
   * The method treats stays as overlapping when reservation check-in is on/before the
   * day end and check-out is after day start, matching overnight occupancy semantics.
   *
   * @param roomTypeId - Room type UUID.
   * @param date - Business date used to build day start/end boundaries.
   * @returns Number of reservation-room rows considered sold for that date.
   * @remarks Complexity: O(1) application work plus one aggregate DB count query.
   */
  async getSoldCount(roomTypeId: string, date: Date): Promise<number> {
    // Count reservations for this room type on this date
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return prisma.reservationRoom.count({
      where: {
        roomTypeId,
        reservation: {
          checkInDate: { lte: endOfDay },
          checkOutDate: { gt: startOfDay },
          status: { in: ['CONFIRMED', 'CHECKED_IN'] },
        },
      },
    });
  }

  // ============================================================================
  // VALIDATION
  // ============================================================================

  /**
   * Checks whether a room type exists in a hotel and is not soft-deleted.
   *
   * @param hotelId - Hotel UUID.
   * @param roomTypeId - Room type UUID.
   * @returns `true` when the room type exists in the hotel.
   */
  async existsInHotel(hotelId: string, roomTypeId: string): Promise<boolean> {
    const count = await prisma.roomType.count({
      where: {
        id: roomTypeId,
        hotelId,
        deletedAt: null,
      },
    });
    return count > 0;
  }

  /**
   * Counts active room types for a hotel.
   *
   * @param hotelId - Hotel UUID.
   * @returns Number of non-deleted room types in the hotel.
   */
  async countByHotel(hotelId: string): Promise<number> {
    return prisma.roomType.count({
      where: {
        hotelId,
        deletedAt: null,
      },
    });
  }

  /**
   * Checks whether a room type has active or future reservations.
   *
   * @param roomTypeId - Room type UUID.
   * @returns `true` when at least one reservation is `CONFIRMED` or `CHECKED_IN` and not checked out.
   */
  async hasActiveReservations(roomTypeId: string): Promise<boolean> {
    const count = await prisma.reservationRoom.count({
      where: {
        roomTypeId,
        reservation: {
          status: { in: ['CONFIRMED', 'CHECKED_IN'] },
          checkOutDate: { gte: new Date() },
        },
      },
    });
    return count > 0;
  }

  /**
   * Checks whether any active rooms are linked to a room type.
   *
   * @param roomTypeId - Room type UUID.
   * @returns `true` when one or more non-deleted rooms reference the room type.
   */
  async hasRooms(roomTypeId: string): Promise<boolean> {
    const count = await prisma.room.count({
      where: {
        roomTypeId,
        deletedAt: null,
      },
    });
    return count > 0;
  }
}

export const roomTypesRepository = new RoomTypesRepository();
