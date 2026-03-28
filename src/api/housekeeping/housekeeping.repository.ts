import { prisma } from '../../database/prisma';
import type { Prisma } from '../../generated/prisma';
import type {
  HousekeepingInspectionQueryFilters,
  HousekeepingShiftQueryFilters,
  HousekeepingTaskQueryFilters,
  HousekeepingTaskStatus,
  HousekeepingTaskType,
  InspectionOutcome,
  LostFoundQueryFilters,
} from './housekeeping.types';

export type HousekeepingTaskCreateInput = Prisma.HousekeepingTaskUncheckedCreateInput;
export type HousekeepingTaskUpdateInput = Prisma.HousekeepingTaskUpdateInput;
export type HousekeepingInspectionCreateInput = Prisma.HousekeepingInspectionUncheckedCreateInput;
export type HousekeepingShiftCreateInput = Prisma.HousekeepingShiftUncheckedCreateInput;
export type HousekeepingShiftUpdateInput = Prisma.HousekeepingShiftUpdateInput;
export type HousekeepingShiftAssignmentCreateInput =
  Prisma.HousekeepingShiftAssignmentUncheckedCreateInput;
export type LostFoundItemCreateInput = Prisma.LostFoundItemUncheckedCreateInput;
export type LostFoundItemUpdateInput = Prisma.LostFoundItemUpdateInput;

export class HousekeepingRepository {
  async findTaskById(taskId: string, organizationId: string, hotelId: string) {
    return prisma.housekeepingTask.findFirst({
      where: {
        id: taskId,
        organizationId,
        hotelId,
      },
      include: {
        room: {
          select: {
            id: true,
            roomNumber: true,
            status: true,
            floor: true,
          },
        },
      },
    });
  }

  async createTask(data: HousekeepingTaskCreateInput) {
    return prisma.housekeepingTask.create({ data });
  }

  async updateTask(taskId: string, data: HousekeepingTaskUpdateInput) {
    return prisma.housekeepingTask.update({
      where: { id: taskId },
      data,
    });
  }

  async listTasks(
    organizationId: string,
    hotelId: string,
    filters: HousekeepingTaskQueryFilters,
    pagination: { page: number; limit: number }
  ) {
    const where: Prisma.HousekeepingTaskWhereInput = {
      organizationId,
      hotelId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.taskType ? { taskType: filters.taskType } : {}),
      ...(filters.assignedTo ? { assignedTo: filters.assignedTo } : {}),
      ...(filters.roomId ? { roomId: filters.roomId } : {}),
      ...(filters.from || filters.to
        ? {
            scheduledFor: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.housekeepingTask.findMany({
        where,
        include: {
          room: {
            select: {
              roomNumber: true,
              status: true,
              floor: true,
            },
          },
        },
        orderBy: [{ priority: 'desc' }, { scheduledFor: 'asc' }, { createdAt: 'desc' }],
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      prisma.housekeepingTask.count({ where }),
    ]);

    return { items, total };
  }

  async listPendingTasksForDate(organizationId: string, hotelId: string, date: Date) {
    return prisma.housekeepingTask.findMany({
      where: {
        organizationId,
        hotelId,
        scheduledFor: date,
        status: 'PENDING',
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async findExistingTaskForRoomDate(
    organizationId: string,
    hotelId: string,
    roomId: string,
    date: Date,
    taskType: HousekeepingTaskType,
    statuses: HousekeepingTaskStatus[] = ['PENDING', 'IN_PROGRESS', 'DND']
  ) {
    return prisma.housekeepingTask.findFirst({
      where: {
        organizationId,
        hotelId,
        roomId,
        scheduledFor: date,
        taskType,
        status: { in: statuses },
      },
    });
  }

  async listStayoverRoomsForDate(organizationId: string, hotelId: string, date: Date) {
    return prisma.reservation.findMany({
      where: {
        organizationId,
        hotelId,
        status: 'CHECKED_IN',
        checkInDate: { lte: date },
        checkOutDate: { gt: date },
        declineHousekeeping: false,
        deletedAt: null,
      },
      select: {
        id: true,
        rooms: {
          select: {
            roomId: true,
          },
          take: 1,
        },
      },
    });
  }

  async bulkAssign(taskIds: string[], staffId: string, assignedAt: Date) {
    return prisma.housekeepingTask.updateMany({
      where: {
        id: { in: taskIds },
      },
      data: {
        assignedTo: staffId,
        assignedAt,
      },
    });
  }

  async createInspection(data: HousekeepingInspectionCreateInput) {
    return prisma.housekeepingInspection.create({ data });
  }

  async listInspections(
    organizationId: string,
    hotelId: string,
    filters: HousekeepingInspectionQueryFilters,
    pagination: { page: number; limit: number }
  ) {
    const where: Prisma.HousekeepingInspectionWhereInput = {
      organizationId,
      hotelId,
      ...(filters.taskId ? { taskId: filters.taskId } : {}),
      ...(filters.roomId ? { roomId: filters.roomId } : {}),
      ...(filters.staffId ? { staffId: filters.staffId } : {}),
      ...(filters.outcome ? { outcome: filters.outcome } : {}),
      ...(filters.from || filters.to
        ? {
            createdAt: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.housekeepingInspection.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      prisma.housekeepingInspection.count({ where }),
    ]);

    return { items, total };
  }

  async findInspectionById(inspId: string, organizationId: string, hotelId: string) {
    return prisma.housekeepingInspection.findFirst({
      where: {
        id: inspId,
        organizationId,
        hotelId,
      },
    });
  }

  async getTaskInspections(taskId: string, organizationId: string, hotelId: string) {
    return prisma.housekeepingInspection.findMany({
      where: {
        taskId,
        organizationId,
        hotelId,
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async getRoomInspections(roomId: string, organizationId: string, hotelId: string) {
    return prisma.housekeepingInspection.findMany({
      where: {
        roomId,
        organizationId,
        hotelId,
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async getStaffInspections(
    staffId: string,
    organizationId: string,
    hotelId: string,
    from: Date,
    to: Date
  ) {
    return prisma.housekeepingInspection.findMany({
      where: {
        staffId,
        organizationId,
        hotelId,
        createdAt: {
          gte: from,
          lte: to,
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async countStaffCompletedTasks(
    staffId: string,
    organizationId: string,
    hotelId: string,
    from: Date,
    to: Date
  ) {
    return prisma.housekeepingTask.count({
      where: {
        assignedTo: staffId,
        organizationId,
        hotelId,
        completedAt: {
          gte: from,
          lte: to,
        },
      },
    });
  }

  async getStaffCompletedTaskDurations(
    staffId: string,
    organizationId: string,
    hotelId: string,
    from: Date,
    to: Date
  ) {
    return prisma.housekeepingTask.findMany({
      where: {
        assignedTo: staffId,
        organizationId,
        hotelId,
        completedAt: {
          gte: from,
          lte: to,
        },
      },
      select: {
        actualMinutes: true,
      },
    });
  }

  async countInspectionOutcomes(
    staffId: string,
    organizationId: string,
    hotelId: string,
    from: Date,
    to: Date,
    outcome: InspectionOutcome
  ) {
    return prisma.housekeepingInspection.count({
      where: {
        staffId,
        organizationId,
        hotelId,
        outcome,
        createdAt: {
          gte: from,
          lte: to,
        },
      },
    });
  }

  async createShift(data: HousekeepingShiftCreateInput) {
    return prisma.housekeepingShift.create({ data });
  }

  async updateShift(shiftId: string, data: HousekeepingShiftUpdateInput) {
    return prisma.housekeepingShift.update({
      where: { id: shiftId },
      data,
      include: {
        assignments: {
          orderBy: [{ createdAt: 'asc' }],
        },
      },
    });
  }

  async findShiftById(shiftId: string, organizationId: string, hotelId: string) {
    return prisma.housekeepingShift.findFirst({
      where: {
        id: shiftId,
        organizationId,
        hotelId,
      },
      include: {
        assignments: {
          orderBy: [{ createdAt: 'asc' }],
        },
      },
    });
  }

  async listShifts(
    organizationId: string,
    hotelId: string,
    filters: HousekeepingShiftQueryFilters,
    pagination: { page: number; limit: number }
  ) {
    const where: Prisma.HousekeepingShiftWhereInput = {
      organizationId,
      hotelId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.date
        ? { shiftDate: filters.date }
        : filters.from || filters.to
          ? {
              shiftDate: {
                ...(filters.from ? { gte: filters.from } : {}),
                ...(filters.to ? { lte: filters.to } : {}),
              },
            }
          : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.housekeepingShift.findMany({
        where,
        include: {
          assignments: {
            orderBy: [{ createdAt: 'asc' }],
          },
        },
        orderBy: [{ shiftDate: 'asc' }, { startTime: 'asc' }, { createdAt: 'desc' }],
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      prisma.housekeepingShift.count({ where }),
    ]);

    return { items, total };
  }

  async createShiftAssignments(data: HousekeepingShiftAssignmentCreateInput[]) {
    if (data.length === 0) {
      return { count: 0 };
    }

    return prisma.housekeepingShiftAssignment.createMany({
      data,
      skipDuplicates: true,
    });
  }

  async deleteShiftAssignments(shiftId: string) {
    return prisma.housekeepingShiftAssignment.deleteMany({
      where: {
        shiftId,
      },
    });
  }

  async countActiveShiftAssignmentsForDate(organizationId: string, hotelId: string, date: Date) {
    return prisma.housekeepingShiftAssignment.findMany({
      where: {
        organizationId,
        hotelId,
        shift: {
          shiftDate: date,
          status: {
            in: ['PLANNED', 'ACTIVE'],
          },
        },
      },
      select: {
        staffId: true,
      },
    });
  }

  async createLostFoundItem(data: LostFoundItemCreateInput) {
    return prisma.lostFoundItem.create({ data });
  }

  async updateLostFoundItem(itemId: string, data: LostFoundItemUpdateInput) {
    return prisma.lostFoundItem.update({
      where: { id: itemId },
      data,
    });
  }

  async findLostFoundItemById(itemId: string, organizationId: string, hotelId: string) {
    return prisma.lostFoundItem.findFirst({
      where: {
        id: itemId,
        organizationId,
        hotelId,
      },
    });
  }

  async listLostFoundItems(
    organizationId: string,
    hotelId: string,
    filters: LostFoundQueryFilters,
    pagination: { page: number; limit: number }
  ) {
    const where: Prisma.LostFoundItemWhereInput = {
      organizationId,
      hotelId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.roomId ? { roomId: filters.roomId } : {}),
      ...(filters.from || filters.to
        ? {
            foundAt: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.lostFoundItem.findMany({
        where,
        orderBy: [{ foundAt: 'desc' }],
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      prisma.lostFoundItem.count({ where }),
    ]);

    return { items, total };
  }
}

export const housekeepingRepository = new HousekeepingRepository();
