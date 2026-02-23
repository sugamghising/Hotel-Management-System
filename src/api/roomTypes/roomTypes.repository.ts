// src/features/room-types/room-types.repository.ts

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

  async findById(id: string, include?: Prisma.RoomTypeInclude): Promise<RoomType | null> {
    return prisma.roomType.findUnique({
      where: { id },
      ...(include && { include }),
    }) as Promise<RoomType | null>;
  }

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

  async create(data: RoomTypeCreateInput): Promise<RoomType> {
    return prisma.roomType.create({ data }) as unknown as Promise<RoomType>;
  }

  async update(id: string, data: RoomTypeUpdateInput): Promise<RoomType> {
    return prisma.roomType.update({
      where: { id },
      data,
    }) as unknown as Promise<RoomType>;
  }

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

  async getDefaultTotalRooms(roomTypeId: string): Promise<number> {
    return prisma.room.count({
      where: {
        roomTypeId,
        deletedAt: null,
      },
    });
  }

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

  async countByHotel(hotelId: string): Promise<number> {
    return prisma.roomType.count({
      where: {
        hotelId,
        deletedAt: null,
      },
    });
  }

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
