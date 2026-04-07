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
  /**
   * Retrieves a housekeeping task constrained to an organization and hotel scope.
   *
   * @param taskId - Housekeeping task UUID to locate.
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @returns The matching task with room snapshot fields, or null when no scoped task exists.
   */
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

  /**
   * Persists a new housekeeping task record.
   *
   * @param data - Prisma create payload for the housekeeping task.
   * @returns The created housekeeping task row.
   */
  async createTask(data: HousekeepingTaskCreateInput) {
    return prisma.housekeepingTask.create({ data });
  }

  /**
   * Updates a housekeeping task by primary identifier.
   *
   * @param taskId - Housekeeping task UUID to update.
   * @param data - Prisma update payload containing changed task fields.
   * @returns The updated housekeeping task row.
   */
  async updateTask(taskId: string, data: HousekeepingTaskUpdateInput) {
    return prisma.housekeepingTask.update({
      where: { id: taskId },
      data,
    });
  }

  /**
   * Lists housekeeping tasks for a hotel using optional operational filters and pagination.
   *
   * Builds a scoped `where` clause from status, task type, assignee, room, and scheduled date bounds,
   * then executes a transactional `findMany` plus `count` so list items and totals are consistent.
   *
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @param filters - Optional query filters applied to task status, type, assignee, room, and date range.
   * @param pagination - Pagination controls containing 1-based page and page size limit.
   * @returns A page of tasks with room details plus the full matching row count.
   * @remarks Complexity: O(k + p) query construction plus two database operations; dominant cost is DB filtering/sorting over k matching rows and returning p page rows.
   */
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

  /**
   * Lists pending housekeeping tasks scheduled for a specific UTC business date.
   *
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @param date - Date-only UTC value used to match `scheduledFor`.
   * @returns Pending tasks ordered by highest priority first, then oldest creation time.
   */
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

  /**
   * Finds an existing room task for a date and task type across active-like statuses.
   *
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @param roomId - Room UUID the task belongs to.
   * @param date - Date-only UTC value to match against `scheduledFor`.
   * @param taskType - Housekeeping task type being deduplicated.
   * @param statuses - Task statuses considered conflicting; defaults to active workflow states.
   * @returns The first conflicting task when present, otherwise null.
   */
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

  /**
   * Returns checked-in reservations that represent stayovers for a specific business date.
   *
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @param date - Date-only UTC value used to determine in-house stayovers.
   * @returns Reservation identifiers with the first linked room reference for stayover task generation.
   */
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

  /**
   * Assigns multiple tasks to a staff member in one batch update.
   *
   * @param taskIds - Task UUIDs targeted for assignment.
   * @param staffId - Staff user UUID to assign to each task.
   * @param assignedAt - Timestamp recorded as the assignment moment.
   * @returns Prisma batch update result containing the number of affected rows.
   * @remarks Complexity: O(t) over the database `IN` set size t, executed as a single write query.
   */
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

  /**
   * Persists a housekeeping inspection record.
   *
   * @param data - Prisma create payload for a housekeeping inspection.
   * @returns The created inspection row.
   */
  async createInspection(data: HousekeepingInspectionCreateInput) {
    return prisma.housekeepingInspection.create({ data });
  }

  /**
   * Lists inspections for a hotel with optional task, staff, outcome, and date filters.
   *
   * Builds a scoped filter object and executes `findMany` with `count` in one transaction so
   * pagination metadata aligns with the returned page.
   *
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @param filters - Optional inspection filters for task, room, staff, outcome, and created window.
   * @param pagination - Pagination controls containing 1-based page and page size limit.
   * @returns Paginated inspection rows plus the total matching count.
   * @remarks Complexity: O(k + p) with two DB operations; cost is dominated by filtered scan/sort over k rows and returning p rows.
   */
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

  /**
   * Retrieves a single inspection constrained to organization and hotel scope.
   *
   * @param inspId - Inspection UUID to locate.
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @returns Matching inspection row, or null when no scoped record exists.
   */
  async findInspectionById(inspId: string, organizationId: string, hotelId: string) {
    return prisma.housekeepingInspection.findFirst({
      where: {
        id: inspId,
        organizationId,
        hotelId,
      },
    });
  }

  /**
   * Retrieves inspection history for a housekeeping task in descending creation order.
   *
   * @param taskId - Housekeeping task UUID.
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @returns Inspection rows for the task, newest first.
   */
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

  /**
   * Retrieves inspection history for a room in descending creation order.
   *
   * @param roomId - Room UUID to inspect.
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @returns Inspection rows for the room, newest first.
   */
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

  /**
   * Retrieves inspections submitted for a staff member within a time window.
   *
   * @param staffId - Staff user UUID to filter by.
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @param from - Inclusive lower bound for `createdAt`.
   * @param to - Inclusive upper bound for `createdAt`.
   * @returns Matching staff inspections ordered newest first.
   */
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

  /**
   * Counts tasks completed by a staff member during a period.
   *
   * @param staffId - Staff user UUID to filter by.
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @param from - Inclusive lower bound for `completedAt`.
   * @param to - Inclusive upper bound for `completedAt`.
   * @returns Number of completed tasks assigned to the staff member in the period.
   */
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

  /**
   * Returns recorded completion durations for a staff member within a period.
   *
   * @param staffId - Staff user UUID to filter by.
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @param from - Inclusive lower bound for `completedAt`.
   * @param to - Inclusive upper bound for `completedAt`.
   * @returns Task rows exposing only `actualMinutes` for workload analytics.
   */
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

  /**
   * Counts inspections with a specific outcome for a staff member in a date window.
   *
   * @param staffId - Staff user UUID to filter by.
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @param from - Inclusive lower bound for inspection creation time.
   * @param to - Inclusive upper bound for inspection creation time.
   * @param outcome - Inspection outcome literal to count.
   * @returns Number of matching inspection rows.
   */
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

  /**
   * Persists a housekeeping shift.
   *
   * @param data - Prisma create payload for the shift.
   * @returns The created shift row.
   */
  async createShift(data: HousekeepingShiftCreateInput) {
    return prisma.housekeepingShift.create({ data });
  }

  /**
   * Updates a shift and returns it with ordered staff assignments.
   *
   * @param shiftId - Shift UUID to update.
   * @param data - Prisma update payload for shift fields.
   * @returns Updated shift including assignment rows ordered by creation time.
   */
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

  /**
   * Retrieves a shift by identifier within organization and hotel scope.
   *
   * @param shiftId - Shift UUID to locate.
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @returns Matching shift with ordered assignments, or null when missing.
   */
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

  /**
   * Lists shifts with optional status/date filters and paginated results.
   *
   * Builds a scoped date filter (exact date or range), then executes paginated retrieval and count
   * in one transaction so shift rows and totals represent the same snapshot.
   *
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @param filters - Optional shift filters for status and date boundaries.
   * @param pagination - Pagination controls containing 1-based page and page size limit.
   * @returns Paginated shift rows with assignments plus total count.
   * @remarks Complexity: O(k + p) with two database operations; dominant cost is DB filtering/sorting over k candidate rows and returning p rows.
   */
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

  /**
   * Creates multiple shift assignments, skipping duplicate staff-to-shift tuples.
   *
   * @param data - Assignment create payloads for one shift staffing batch.
   * @returns Batch result with affected row count, or `{ count: 0 }` when input is empty.
   * @remarks Complexity: O(a) over assignment payload size a; executed as one bulk insert query.
   */
  async createShiftAssignments(data: HousekeepingShiftAssignmentCreateInput[]) {
    if (data.length === 0) {
      return { count: 0 };
    }

    return prisma.housekeepingShiftAssignment.createMany({
      data,
      skipDuplicates: true,
    });
  }

  /**
   * Deletes all assignment rows for a shift.
   *
   * @param shiftId - Shift UUID whose assignments should be removed.
   * @returns Prisma batch delete result containing affected row count.
   */
  async deleteShiftAssignments(shiftId: string) {
    return prisma.housekeepingShiftAssignment.deleteMany({
      where: {
        shiftId,
      },
    });
  }

  /**
   * Returns active/planned shift assignments for a date to support workload calculations.
   *
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @param date - Date-only UTC value matched against `shiftDate`.
   * @returns Assignment rows containing only `staffId` for counting active shifts per staff.
   */
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

  /**
   * Persists a lost-and-found item record.
   *
   * @param data - Prisma create payload for the lost-and-found item.
   * @returns The created lost-and-found row.
   */
  async createLostFoundItem(data: LostFoundItemCreateInput) {
    return prisma.lostFoundItem.create({ data });
  }

  /**
   * Updates a lost-and-found item by identifier.
   *
   * @param itemId - Lost-and-found item UUID to update.
   * @param data - Prisma update payload containing changed item fields.
   * @returns The updated lost-and-found row.
   */
  async updateLostFoundItem(itemId: string, data: LostFoundItemUpdateInput) {
    return prisma.lostFoundItem.update({
      where: { id: itemId },
      data,
    });
  }

  /**
   * Retrieves a lost-and-found item constrained to organization and hotel scope.
   *
   * @param itemId - Lost-and-found item UUID to locate.
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @returns Matching item row, or null when no scoped record exists.
   */
  async findLostFoundItemById(itemId: string, organizationId: string, hotelId: string) {
    return prisma.lostFoundItem.findFirst({
      where: {
        id: itemId,
        organizationId,
        hotelId,
      },
    });
  }

  /**
   * Lists lost-and-found items with status/category/room/date filters and pagination.
   *
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @param filters - Optional filters for item status, category, room, and found timestamp bounds.
   * @param pagination - Pagination controls containing 1-based page and page size limit.
   * @returns Paginated lost-and-found items plus total matching count.
   * @remarks Complexity: O(k + p) with two database operations; cost is dominated by DB filtering and ordering on found timestamp.
   */
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
