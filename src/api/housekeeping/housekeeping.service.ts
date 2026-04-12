import { config } from '../../config';
import { BadRequestError, ConflictError, NotFoundError, logger } from '../../core';
import { prisma } from '../../database/prisma';
import type { Prisma } from '../../generated/prisma';
import { type HousekeepingRepository, housekeepingRepository } from './housekeeping.repository';
import type {
  AssignShiftStaffInput,
  AssignTaskInput,
  AutoGenerateTasksInput,
  BulkAssignInput,
  CancelTaskInput,
  CompleteTaskInput,
  CreateLostFoundItemInput,
  CreateShiftInput,
  CreateTaskInput,
  DndTaskInput,
  HousekeepingDashboardResponse,
  HousekeepingInspectionQueryFilters,
  HousekeepingInspectionResponse,
  HousekeepingShiftQueryFilters,
  HousekeepingShiftResponse,
  HousekeepingTaskQueryFilters,
  HousekeepingTaskResponse,
  InspectionScores,
  LostFoundItemResponse,
  LostFoundQueryFilters,
  NotifyLostFoundInput,
  StaffScoreHistoryResponse,
  StaffWorkloadItem,
  SubmitInspectionInput,
  UpdateLostFoundItemInput,
  UpdateShiftInput,
  UpdateTaskInput,
} from './housekeeping.types';

const INSPECTION_WEIGHTS: Record<keyof InspectionScores, number> = {
  bedding: 0.25,
  bathroom: 0.25,
  floors: 0.15,
  amenities: 0.15,
  furniture: 0.1,
  general: 0.1,
};

const SYSTEM_ACTOR_ID = config.system.userId;

export class HousekeepingService {
  private housekeepingRepo: HousekeepingRepository;

  /**
   * Creates a housekeeping service with an overridable repository dependency.
   *
   * @param repository - Repository implementation used for housekeeping persistence and queries.
   */
  constructor(repository: HousekeepingRepository = housekeepingRepository) {
    this.housekeepingRepo = repository;
  }

  /**
   * Creates a housekeeping task after validating room scope and duplicate-active-task rules.
   *
   * Validates that the room belongs to the organization and hotel, normalizes the scheduled date,
   * and blocks creation when a similar task already exists in active statuses for the same room/day.
   * It then persists the task with fallback assignment and priority defaults and returns the mapped API shape.
   *
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @param input - Task creation payload including room, task type, schedule, and optional assignment.
   * @param userId - Optional actor UUID; defaults to the configured system actor when omitted.
   * @returns The created housekeeping task response.
   * @throws {NotFoundError} When the target room does not exist in the requested hotel scope.
   * @throws {ConflictError} When an active duplicate task exists for the same room, date, and task type.
   */
  async createTask(
    organizationId: string,
    hotelId: string,
    input: CreateTaskInput,
    userId?: string
  ): Promise<HousekeepingTaskResponse> {
    const room = await prisma.room.findFirst({
      where: {
        id: input.roomId,
        organizationId,
        hotelId,
        deletedAt: null,
      },
    });

    if (!room) {
      throw new NotFoundError('Room not found in this hotel');
    }

    const scheduledFor = this.asDateOnly(input.scheduledFor);

    const existingTask = await this.housekeepingRepo.findExistingTaskForRoomDate(
      organizationId,
      hotelId,
      input.roomId,
      scheduledFor,
      input.taskType,
      ['PENDING', 'IN_PROGRESS', 'DND', 'ISSUES_REPORTED']
    );

    if (existingTask) {
      throw new ConflictError(
        'A similar active housekeeping task already exists for this room/date'
      );
    }

    const task = await this.housekeepingRepo.createTask({
      organizationId,
      hotelId,
      roomId: input.roomId,
      taskType: input.taskType,
      status: 'PENDING',
      priority: input.priority ?? room.cleaningPriority,
      assignedTo: input.assignedTo ?? null,
      assignedAt: input.assignedTo ? new Date() : null,
      scheduledFor,
      notes: input.notes ?? null,
      guestRequests: input.guestRequests ?? null,
      createdBy: userId ?? SYSTEM_ACTOR_ID,
    });

    logger.info('Housekeeping task created', {
      taskId: task.id,
      hotelId,
      organizationId,
      taskType: task.taskType,
    });

    return this.mapTask(task);
  }

  /**
   * Lists housekeeping tasks for a hotel with filter and pagination controls.
   *
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @param filters - Query filters for status, type, assignee, room, and schedule window.
   * @param pagination - Pagination controls containing 1-based page and page size limit.
   * @returns Task responses mapped to API contract plus total count metadata.
   */
  async listTasks(
    organizationId: string,
    hotelId: string,
    filters: HousekeepingTaskQueryFilters,
    pagination: { page: number; limit: number }
  ) {
    const { items, total } = await this.housekeepingRepo.listTasks(
      organizationId,
      hotelId,
      filters,
      pagination
    );

    return {
      items: items.map((item) => this.mapTask(item)),
      total,
    };
  }

  /**
   * Retrieves a single housekeeping task by identifier within organization and hotel scope.
   *
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @param taskId - Housekeeping task UUID.
   * @returns Task response for the requested identifier.
   * @throws {NotFoundError} When no scoped task exists for the given identifier.
   */
  async getTaskDetail(
    organizationId: string,
    hotelId: string,
    taskId: string
  ): Promise<HousekeepingTaskResponse> {
    const task = await this.housekeepingRepo.findTaskById(taskId, organizationId, hotelId);

    if (!task) {
      throw new NotFoundError('Task not found');
    }

    return this.mapTask(task);
  }

  /**
   * Updates mutable housekeeping task fields when the task is still operational.
   *
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @param taskId - Housekeeping task UUID to modify.
   * @param input - Partial update payload for priority, notes, requests, and schedule date.
   * @returns Updated task mapped to API response shape.
   * @throws {NotFoundError} When the scoped task cannot be found.
   * @throws {BadRequestError} When attempting to modify tasks already `VERIFIED` or `CANCELLED`.
   */
  async updateTask(
    organizationId: string,
    hotelId: string,
    taskId: string,
    input: UpdateTaskInput
  ): Promise<HousekeepingTaskResponse> {
    const task = await this.housekeepingRepo.findTaskById(taskId, organizationId, hotelId);

    if (!task) {
      throw new NotFoundError('Task not found');
    }

    if (task.status === 'VERIFIED' || task.status === 'CANCELLED') {
      throw new BadRequestError('Cannot update a verified or cancelled task');
    }

    const updated = await this.housekeepingRepo.updateTask(taskId, {
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.guestRequests !== undefined ? { guestRequests: input.guestRequests } : {}),
      ...(input.scheduledFor !== undefined
        ? { scheduledFor: this.asDateOnly(input.scheduledFor) }
        : {}),
    });

    return this.mapTask(updated);
  }

  /**
   * Assigns a housekeeping task to an active staff member.
   *
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @param taskId - Housekeeping task UUID to assign.
   * @param input - Assignment payload containing the target staff UUID.
   * @returns Updated task response with assignment fields set.
   * @throws {NotFoundError} When the task or staff member is missing in scope.
   */
  async assignTask(
    organizationId: string,
    hotelId: string,
    taskId: string,
    input: AssignTaskInput
  ): Promise<HousekeepingTaskResponse> {
    const [task, staff] = await Promise.all([
      this.housekeepingRepo.findTaskById(taskId, organizationId, hotelId),
      prisma.user.findFirst({
        where: {
          id: input.staffId,
          organizationId,
          deletedAt: null,
          status: 'ACTIVE',
        },
      }),
    ]);

    if (!task) {
      throw new NotFoundError('Task not found');
    }

    if (!staff) {
      throw new NotFoundError('Staff member not found');
    }

    const updated = await this.housekeepingRepo.updateTask(taskId, {
      assignedTo: input.staffId,
      assignedAt: new Date(),
    });

    return this.mapTask(updated);
  }

  /**
   * Starts a housekeeping task and synchronizes room status to an active cleaning state.
   *
   * The method validates transition eligibility (`PENDING`, `ISSUES_REPORTED`, or `DND`), derives
   * an acting assignee fallback, and performs a transaction that updates both room and task records.
   * Room status is mapped to `OCCUPIED_CLEANING` or `VACANT_CLEANING` based on occupancy prefix.
   *
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @param taskId - Housekeeping task UUID to start.
   * @param userId - Optional actor UUID used when no assignee exists.
   * @returns Updated task response in `IN_PROGRESS` state.
   * @throws {NotFoundError} When the scoped task or linked room cannot be found.
   * @throws {BadRequestError} When the current status does not allow starting work.
   */
  async startTask(
    organizationId: string,
    hotelId: string,
    taskId: string,
    userId?: string
  ): Promise<HousekeepingTaskResponse> {
    const task = await this.housekeepingRepo.findTaskById(taskId, organizationId, hotelId);

    if (!task) {
      throw new NotFoundError('Task not found');
    }

    if (!['PENDING', 'ISSUES_REPORTED', 'DND'].includes(task.status)) {
      throw new BadRequestError(`Task cannot be started from status ${task.status}`);
    }

    const taskUserId = userId ?? task.assignedTo ?? task.createdBy;

    const updated = await prisma.$transaction(async (tx) => {
      const room = await tx.room.findUnique({ where: { id: task.roomId } });
      if (!room) {
        throw new NotFoundError('Room not found');
      }

      const roomStatus = room.status.startsWith('OCCUPIED')
        ? 'OCCUPIED_CLEANING'
        : 'VACANT_CLEANING';

      await tx.room.update({
        where: { id: task.roomId },
        data: {
          status: roomStatus,
          updatedAt: new Date(),
        },
      });

      return tx.housekeepingTask.update({
        where: { id: task.id },
        data: {
          status: 'IN_PROGRESS',
          startedAt: new Date(),
          assignedTo: task.assignedTo ?? taskUserId,
          assignedAt: task.assignedAt ?? new Date(),
          dndAt: null,
          dndBy: null,
          dndReason: null,
        },
      });
    });

    return this.mapTask(updated);
  }

  /**
   * Completes an in-progress housekeeping task and transitions room cleanliness status.
   *
   * Computes effective completion duration (with a minimum one-minute fallback), then uses a
   * transaction to mark the room as dirty post-cleaning and store completion notes, photos,
   * supplies, and actual minutes on the task.
   *
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @param taskId - Housekeeping task UUID to complete.
   * @param input - Completion payload with optional notes, media, supplies, and explicit minutes.
   * @param _userId - Optional actor UUID reserved for interface consistency.
   * @returns Updated task response in `COMPLETED` status.
   * @throws {NotFoundError} When the scoped task cannot be found.
   * @throws {BadRequestError} When the task is not currently `IN_PROGRESS`.
   */
  async completeTask(
    organizationId: string,
    hotelId: string,
    taskId: string,
    input: CompleteTaskInput,
    _userId?: string
  ): Promise<HousekeepingTaskResponse> {
    const task = await this.housekeepingRepo.findTaskById(taskId, organizationId, hotelId);

    if (!task) {
      throw new NotFoundError('Task not found');
    }

    if (task.status !== 'IN_PROGRESS') {
      throw new BadRequestError('Only IN_PROGRESS tasks can be completed');
    }

    const completedAt = new Date();
    const startedAt = task.startedAt ?? completedAt;
    const inferredMinutes = Math.max(
      1,
      Math.round((completedAt.getTime() - startedAt.getTime()) / (1000 * 60))
    );

    const postCleanRoomStatus = task.room?.status.startsWith('OCCUPIED')
      ? 'OCCUPIED_DIRTY'
      : 'VACANT_DIRTY';

    const updated = await prisma.$transaction(async (tx) => {
      await tx.room.update({
        where: { id: task.roomId },
        data: {
          status: postCleanRoomStatus,
          updatedAt: new Date(),
        },
      });

      return tx.housekeepingTask.update({
        where: { id: task.id },
        data: {
          status: 'COMPLETED',
          completedAt,
          completionNotes: input.notes ?? null,
          completionPhotos: input.photos ?? [],
          suppliesUsed: input.suppliesUsed ?? [],
          actualMinutes: input.actualMinutes ?? inferredMinutes,
        },
      });
    });

    return this.mapTask(updated);
  }

  /**
   * Marks a housekeeping task as do-not-disturb and records DND metadata.
   *
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @param taskId - Housekeeping task UUID to update.
   * @param input - DND payload with optional reason text.
   * @param userId - Optional actor UUID; falls back to assignee or creator.
   * @returns Updated task response in `DND` state.
   * @throws {NotFoundError} When the scoped task cannot be found.
   * @throws {BadRequestError} When the task is already `VERIFIED` or `CANCELLED`.
   */
  async markDnd(
    organizationId: string,
    hotelId: string,
    taskId: string,
    input: DndTaskInput,
    userId?: string
  ): Promise<HousekeepingTaskResponse> {
    const task = await this.housekeepingRepo.findTaskById(taskId, organizationId, hotelId);

    if (!task) {
      throw new NotFoundError('Task not found');
    }

    if (task.status === 'VERIFIED' || task.status === 'CANCELLED') {
      throw new BadRequestError(`Cannot mark task DND from status ${task.status}`);
    }

    const updated = await this.housekeepingRepo.updateTask(task.id, {
      status: 'DND',
      dndAt: new Date(),
      dndBy: userId ?? task.assignedTo ?? task.createdBy,
      dndReason: input.reason ?? null,
    });

    return this.mapTask(updated);
  }

  /**
   * Cancels a housekeeping task and stores cancellation audit fields.
   *
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @param taskId - Housekeeping task UUID to cancel.
   * @param input - Cancellation payload containing required reason text.
   * @param userId - Optional actor UUID; defaults to task creator when omitted.
   * @returns Updated task response in `CANCELLED` status.
   * @throws {NotFoundError} When the scoped task cannot be found.
   * @throws {BadRequestError} When the task is already `VERIFIED` or `CANCELLED`.
   */
  async cancelTask(
    organizationId: string,
    hotelId: string,
    taskId: string,
    input: CancelTaskInput,
    userId?: string
  ): Promise<HousekeepingTaskResponse> {
    const task = await this.housekeepingRepo.findTaskById(taskId, organizationId, hotelId);

    if (!task) {
      throw new NotFoundError('Task not found');
    }

    if (task.status === 'VERIFIED' || task.status === 'CANCELLED') {
      throw new BadRequestError(`Cannot cancel task from status ${task.status}`);
    }

    const updated = await this.housekeepingRepo.updateTask(task.id, {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelledBy: userId ?? task.createdBy,
      cancellationReason: input.reason,
    });

    return this.mapTask(updated);
  }

  /**
   * Generates stayover cleaning tasks for in-house reservations on a target business date.
   *
   * Iterates stayover reservations, skips records without a room reference, de-duplicates against
   * existing tasks across active and completed statuses, and creates `CLEANING_STAYOVER` tasks with
   * optional night-audit batch metadata.
   *
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @param input - Generator payload containing the date to evaluate.
   * @param userId - Optional actor UUID stored as creator for generated tasks.
   * @param options - Optional metadata such as `nightAuditBatchId` for provenance.
   * @returns Count of stayover tasks created during this batch run.
   * @remarks Complexity: O(r) repository lookups and conditional inserts where r is stayover reservations returned for the date.
   */
  async autoGenerateStayoverTasks(
    organizationId: string,
    hotelId: string,
    input: AutoGenerateTasksInput,
    userId?: string,
    options?: { nightAuditBatchId?: string }
  ) {
    const date = this.asDateOnly(input.date);
    const reservations = await this.housekeepingRepo.listStayoverRoomsForDate(
      organizationId,
      hotelId,
      date
    );

    let created = 0;

    for (const reservation of reservations) {
      const roomId = reservation.rooms[0]?.roomId;
      if (!roomId) {
        continue;
      }

      const existing = await this.housekeepingRepo.findExistingTaskForRoomDate(
        organizationId,
        hotelId,
        roomId,
        date,
        'CLEANING_STAYOVER',
        ['PENDING', 'IN_PROGRESS', 'DND', 'ISSUES_REPORTED', 'COMPLETED', 'VERIFIED']
      );

      if (existing) {
        continue;
      }

      await this.housekeepingRepo.createTask({
        organizationId,
        hotelId,
        roomId,
        taskType: 'CLEANING_STAYOVER',
        status: 'PENDING',
        priority: 0,
        scheduledFor: date,
        createdBy: userId ?? SYSTEM_ACTOR_ID,
        ...(options?.nightAuditBatchId ? { nightAuditBatchId: options.nightAuditBatchId } : {}),
      });

      created += 1;
    }

    return { created };
  }

  /**
   * Auto-assigns pending housekeeping tasks across active staff using round-robin distribution.
   *
   * Validates staff scope, resolves candidate tasks from explicit IDs or date-based pending queues,
   * prioritizes tasks by priority and creation time, and performs assignment updates in one transaction.
   *
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @param input - Batch assignment payload including staff IDs and optional task/date filters.
   * @returns Assignment summary with affected task count and task-to-staff pairs.
   * @throws {BadRequestError} When no staff IDs are provided.
   * @throws {NotFoundError} When no valid active staff records are found.
   * @remarks Complexity: O(t log t + t) where t is assignable task count; sorting dominates before transactional updates.
   */
  async bulkAutoAssign(
    organizationId: string,
    hotelId: string,
    input: BulkAssignInput
  ): Promise<{ assignedCount: number; assignments: Array<{ taskId: string; staffId: string }> }> {
    const staffIds = Array.from(new Set(input.staffIds));

    if (staffIds.length === 0) {
      throw new BadRequestError('At least one staff member is required');
    }

    const staff = await prisma.user.findMany({
      where: {
        id: { in: staffIds },
        organizationId,
        status: 'ACTIVE',
        deletedAt: null,
      },
      select: { id: true },
    });

    if (staff.length === 0) {
      throw new NotFoundError('No valid staff members found for assignment');
    }

    const validStaffIds = staff.map((item) => item.id);

    let tasks =
      input.taskIds && input.taskIds.length > 0
        ? await prisma.housekeepingTask.findMany({
            where: {
              id: { in: input.taskIds },
              organizationId,
              hotelId,
              status: 'PENDING',
            },
            orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
          })
        : await this.housekeepingRepo.listPendingTasksForDate(
            organizationId,
            hotelId,
            this.asDateOnly(input.date ?? new Date())
          );

    if (tasks.length === 0) {
      return { assignedCount: 0, assignments: [] };
    }

    tasks = tasks.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    const now = new Date();
    const assignments: Array<{ taskId: string; staffId: string }> = [];

    await prisma.$transaction(async (tx) => {
      for (const [index, task] of tasks.entries()) {
        const staffId = validStaffIds[index % validStaffIds.length];

        if (!staffId) {
          continue;
        }

        await tx.housekeepingTask.update({
          where: { id: task.id },
          data: {
            assignedTo: staffId,
            assignedAt: now,
          },
        });

        assignments.push({ taskId: task.id, staffId });
      }
    });

    return {
      assignedCount: assignments.length,
      assignments,
    };
  }

  /**
   * Records a housekeeping inspection, updates task/room outcomes, and optionally raises maintenance.
   *
   * The workflow enforces that only `COMPLETED` tasks can be inspected, computes weighted score and
   * auto-fail outcome, persists inspection data, transitions the task to `VERIFIED` or `ISSUES_REPORTED`,
   * updates room cleanliness status, and can create a follow-up maintenance request when required.
   *
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @param input - Inspection payload including scores, optional failure items, and maintenance flags.
   * @param userId - Optional inspector UUID; defaults to task creator when omitted.
   * @returns Created inspection mapped to API response shape.
   * @throws {NotFoundError} When the referenced housekeeping task is missing in scope.
   * @throws {BadRequestError} When attempting inspection for a task not in `COMPLETED` status.
   * @remarks Complexity: O(f) where f is failure item count; dominant cost is transactional DB writes across inspection, task, room, and optional maintenance records.
   */
  async submitInspection(
    organizationId: string,
    hotelId: string,
    input: SubmitInspectionInput,
    userId?: string
  ): Promise<HousekeepingInspectionResponse> {
    const task = await this.housekeepingRepo.findTaskById(input.taskId, organizationId, hotelId);

    if (!task) {
      throw new NotFoundError('Task not found');
    }

    if (task.status !== 'COMPLETED') {
      throw new BadRequestError('Inspection can only be submitted for completed tasks');
    }

    const overallScore = this.calculateInspectionScore(input.scores);
    const hasAutoFail = this.hasAutoFailCategory(input.scores);
    const outcome = !hasAutoFail && overallScore >= 85 ? 'PASSED' : 'FAILED';
    const scoresJson = input.scores as unknown as Prisma.InputJsonValue;
    const failureItemsJson = (input.failureItems ?? []) as unknown as Prisma.InputJsonValue;
    const isOccupied = task.room?.status.startsWith('OCCUPIED') ?? false;

    const inspection = await prisma.$transaction(async (tx) => {
      let maintenanceRequestId: string | null = null;

      if (input.requiresMaintenance) {
        const maintenance = await tx.maintenanceRequest.create({
          data: {
            organizationId,
            hotelId,
            roomId: task.roomId,
            category: 'CLEANING',
            priority: 'HIGH',
            title: 'Housekeeping inspection follow-up',
            description:
              input.feedbackToStaff ?? 'Maintenance required after failed housekeeping inspection',
            reportedBy: userId ?? task.createdBy,
            reportedByType: 'STAFF',
          },
        });

        maintenanceRequestId = maintenance.id;
      }

      const createdInspection = await tx.housekeepingInspection.create({
        data: {
          organizationId,
          hotelId,
          taskId: task.id,
          roomId: task.roomId,
          staffId: task.assignedTo,
          inspectedBy: userId ?? task.createdBy,
          scores: scoresJson,
          overallScore,
          outcome,
          autoFailed: hasAutoFail,
          failureItems: failureItemsJson,
          feedbackToStaff: input.feedbackToStaff ?? null,
          requiresMaintenance: input.requiresMaintenance ?? false,
          maintenanceRequestId,
        },
      });

      if (outcome === 'PASSED') {
        await tx.housekeepingTask.update({
          where: { id: task.id },
          data: {
            status: 'VERIFIED',
            verifiedAt: new Date(),
            verifiedBy: userId ?? task.createdBy,
            inspectionScore: overallScore,
            issuesFound: null,
          },
        });

        await tx.room.update({
          where: { id: task.roomId },
          data: {
            status: isOccupied ? 'OCCUPIED_CLEAN' : 'VACANT_CLEAN',
            lastCleanedAt: new Date(),
            updatedAt: new Date(),
          },
        });
      } else {
        await tx.housekeepingTask.update({
          where: { id: task.id },
          data: {
            status: 'ISSUES_REPORTED',
            inspectionScore: overallScore,
            issuesFound: this.serializeFailureItems(input.failureItems),
          },
        });

        await tx.room.update({
          where: { id: task.roomId },
          data: {
            status: isOccupied ? 'OCCUPIED_DIRTY' : 'VACANT_DIRTY',
            updatedAt: new Date(),
          },
        });
      }

      return createdInspection;
    });

    logger.info('Housekeeping inspection submitted', {
      inspectionId: inspection.id,
      taskId: input.taskId,
      overallScore,
      outcome,
    });

    return this.mapInspection(inspection);
  }

  /**
   * Lists housekeeping inspections for a hotel with filters and pagination.
   *
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @param filters - Inspection query filters for task, room, staff, outcome, and date range.
   * @param pagination - Pagination controls containing page and page-size values.
   * @returns Mapped inspection responses plus total result count.
   */
  async listInspections(
    organizationId: string,
    hotelId: string,
    filters: HousekeepingInspectionQueryFilters,
    pagination: { page: number; limit: number }
  ) {
    const { items, total } = await this.housekeepingRepo.listInspections(
      organizationId,
      hotelId,
      filters,
      pagination
    );

    return {
      items: items.map((item) => this.mapInspection(item)),
      total,
    };
  }

  /**
   * Retrieves a single inspection by identifier within organization and hotel scope.
   *
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @param inspectionId - Inspection UUID to fetch.
   * @returns Inspection response for the requested identifier.
   * @throws {NotFoundError} When no scoped inspection exists.
   */
  async getInspectionDetail(
    organizationId: string,
    hotelId: string,
    inspectionId: string
  ): Promise<HousekeepingInspectionResponse> {
    const inspection = await this.housekeepingRepo.findInspectionById(
      inspectionId,
      organizationId,
      hotelId
    );

    if (!inspection) {
      throw new NotFoundError('Inspection not found');
    }

    return this.mapInspection(inspection);
  }

  /**
   * Returns inspection history for a specific housekeeping task.
   *
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @param taskId - Housekeeping task UUID whose inspections are requested.
   * @returns Task inspection responses ordered by repository query ordering.
   */
  async getTaskInspections(organizationId: string, hotelId: string, taskId: string) {
    const inspections = await this.housekeepingRepo.getTaskInspections(
      taskId,
      organizationId,
      hotelId
    );
    return inspections.map((item) => this.mapInspection(item));
  }

  /**
   * Returns inspection history for a room within organization and hotel scope.
   *
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @param roomId - Room UUID whose inspection history is requested.
   * @returns Room inspection responses ordered by repository query ordering.
   */
  async getRoomInspectionHistory(organizationId: string, hotelId: string, roomId: string) {
    const inspections = await this.housekeepingRepo.getRoomInspections(
      roomId,
      organizationId,
      hotelId
    );
    return inspections.map((item) => this.mapInspection(item));
  }

  /**
   * Builds staff quality analytics from inspections, completions, durations, and failure rates.
   *
   * Aggregates repository metrics across a date range, computes pass/reinspection rates and average
   * timing, derives category averages, identifies weak areas, and estimates trend direction from score
   * progression to support coaching and performance reviews.
   *
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @param staffId - Staff UUID whose quality metrics are evaluated.
   * @param from - Optional period start; defaults to 30 days before now.
   * @param to - Optional period end; defaults to current timestamp.
   * @returns Staff quality history summary, category averages, weak area, and trend classification.
   * @remarks Complexity: O(i + d) where i is inspection count and d is duration entry count for the selected period.
   */
  async getStaffQualityHistory(
    organizationId: string,
    hotelId: string,
    staffId: string,
    from?: Date,
    to?: Date
  ): Promise<StaffScoreHistoryResponse> {
    const periodStart = from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const periodEnd = to ?? new Date();

    const [inspections, tasksCompleted, durations, failedCount, staff] = await Promise.all([
      this.housekeepingRepo.getStaffInspections(
        staffId,
        organizationId,
        hotelId,
        periodStart,
        periodEnd
      ),
      this.housekeepingRepo.countStaffCompletedTasks(
        staffId,
        organizationId,
        hotelId,
        periodStart,
        periodEnd
      ),
      this.housekeepingRepo.getStaffCompletedTaskDurations(
        staffId,
        organizationId,
        hotelId,
        periodStart,
        periodEnd
      ),
      this.housekeepingRepo.countInspectionOutcomes(
        staffId,
        organizationId,
        hotelId,
        periodStart,
        periodEnd,
        'FAILED'
      ),
      prisma.user.findFirst({
        where: {
          id: staffId,
          organizationId,
          deletedAt: null,
        },
        select: {
          firstName: true,
          lastName: true,
        },
      }),
    ]);

    const tasksInspected = inspections.length;
    const passCount = inspections.filter((inspection) => inspection.outcome === 'PASSED').length;

    const averageScore =
      tasksInspected === 0
        ? 0
        : inspections.reduce((sum, inspection) => sum + inspection.overallScore, 0) /
          tasksInspected;

    const durationValues = durations
      .map((item) => item.actualMinutes)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

    const averageMinutesPerRoom =
      durationValues.length === 0
        ? 0
        : durationValues.reduce((sum, value) => sum + value, 0) / durationValues.length;

    const categoryAverages = this.computeCategoryAverages(inspections.map((item) => item.scores));
    const weakArea = this.findWeakArea(categoryAverages);

    return {
      staffId,
      staffName: staff ? `${staff.firstName} ${staff.lastName}` : 'Unknown Staff',
      period: `${periodStart.toISOString().slice(0, 10)} to ${periodEnd.toISOString().slice(0, 10)}`,
      summary: {
        tasksCompleted,
        tasksInspected,
        passRate:
          tasksInspected === 0 ? 0 : Number(((passCount / tasksInspected) * 100).toFixed(2)),
        averageScore: Number(averageScore.toFixed(2)),
        averageMinutesPerRoom: Number(averageMinutesPerRoom.toFixed(2)),
        reinspectionRate:
          tasksInspected === 0 ? 0 : Number(((failedCount / tasksInspected) * 100).toFixed(2)),
      },
      categoryAverages,
      weakArea,
      trend: this.computeTrend(inspections.map((inspection) => inspection.overallScore)),
    };
  }

  /**
   * Creates a housekeeping shift after validating schedule boundaries and supervisor scope.
   *
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @param input - Shift creation payload with date, time range, and optional supervisor.
   * @returns Created shift response including assignment list.
   * @throws {BadRequestError} When `endTime` is not later than `startTime`.
   * @throws {NotFoundError} When the provided supervisor is not an active scoped user.
   */
  async createShift(
    organizationId: string,
    hotelId: string,
    input: CreateShiftInput
  ): Promise<HousekeepingShiftResponse> {
    if (input.endTime <= input.startTime) {
      throw new BadRequestError('Shift end time must be after start time');
    }

    if (input.supervisorId) {
      const supervisor = await prisma.user.findFirst({
        where: {
          id: input.supervisorId,
          organizationId,
          status: 'ACTIVE',
          deletedAt: null,
        },
        select: { id: true },
      });

      if (!supervisor) {
        throw new NotFoundError('Shift supervisor not found');
      }
    }

    const shift = await this.housekeepingRepo.createShift({
      organizationId,
      hotelId,
      shiftDate: this.asDateOnly(input.shiftDate),
      startTime: input.startTime,
      endTime: input.endTime,
      status: 'PLANNED',
      supervisorId: input.supervisorId ?? null,
      notes: input.notes ?? null,
    });

    const createdShift = await this.housekeepingRepo.findShiftById(
      shift.id,
      organizationId,
      hotelId
    );

    if (!createdShift) {
      throw new NotFoundError('Shift not found after creation');
    }

    return this.mapShift(createdShift);
  }

  /**
   * Lists housekeeping shifts with query filters and pagination.
   *
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @param filters - Shift filters for status and date boundaries.
   * @param pagination - Pagination controls containing page and page-size values.
   * @returns Mapped shift responses plus total result count.
   */
  async listShifts(
    organizationId: string,
    hotelId: string,
    filters: HousekeepingShiftQueryFilters,
    pagination: { page: number; limit: number }
  ) {
    const { items, total } = await this.housekeepingRepo.listShifts(
      organizationId,
      hotelId,
      filters,
      pagination
    );

    return {
      items: items.map((item) => this.mapShift(item)),
      total,
    };
  }

  /**
   * Retrieves a shift by identifier within organization and hotel scope.
   *
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @param shiftId - Shift UUID to fetch.
   * @returns Shift response including current assignment set.
   * @throws {NotFoundError} When no scoped shift exists.
   */
  async getShiftDetail(
    organizationId: string,
    hotelId: string,
    shiftId: string
  ): Promise<HousekeepingShiftResponse> {
    const shift = await this.housekeepingRepo.findShiftById(shiftId, organizationId, hotelId);

    if (!shift) {
      throw new NotFoundError('Shift not found');
    }

    return this.mapShift(shift);
  }

  /**
   * Updates editable shift fields with time-window and supervisor validation.
   *
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @param shiftId - Shift UUID to modify.
   * @param input - Partial shift update payload for times, status, supervisor, and notes.
   * @returns Updated shift response.
   * @throws {NotFoundError} When the shift or provided supervisor cannot be found in scope.
   * @throws {BadRequestError} When resulting end time is not later than start time.
   */
  async updateShift(
    organizationId: string,
    hotelId: string,
    shiftId: string,
    input: UpdateShiftInput
  ): Promise<HousekeepingShiftResponse> {
    const existing = await this.housekeepingRepo.findShiftById(shiftId, organizationId, hotelId);

    if (!existing) {
      throw new NotFoundError('Shift not found');
    }

    const nextStart = input.startTime ?? existing.startTime;
    const nextEnd = input.endTime ?? existing.endTime;

    if (nextEnd <= nextStart) {
      throw new BadRequestError('Shift end time must be after start time');
    }

    if (input.supervisorId !== undefined && input.supervisorId !== null) {
      const supervisor = await prisma.user.findFirst({
        where: {
          id: input.supervisorId,
          organizationId,
          status: 'ACTIVE',
          deletedAt: null,
        },
        select: { id: true },
      });

      if (!supervisor) {
        throw new NotFoundError('Shift supervisor not found');
      }
    }

    const updated = await this.housekeepingRepo.updateShift(shiftId, {
      ...(input.startTime !== undefined ? { startTime: input.startTime } : {}),
      ...(input.endTime !== undefined ? { endTime: input.endTime } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.supervisorId !== undefined ? { supervisorId: input.supervisorId } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    });

    return this.mapShift(updated);
  }

  /**
   * Assigns staff members to a shift, optionally replacing existing assignments.
   *
   * Deduplicates incoming staff IDs, validates all staff are active in the organization, then runs
   * a transaction that can clear existing assignments before inserting the new set with duplicate
   * protection.
   *
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @param shiftId - Shift UUID whose staffing should be updated.
   * @param input - Assignment payload containing staff IDs, optional role, and replace behavior.
   * @returns Updated shift response with refreshed assignments.
   * @throws {NotFoundError} When the shift is missing or any requested staff member is invalid.
   * @throws {BadRequestError} When no staff IDs are supplied.
   * @remarks Complexity: O(s) over unique staff IDs s, plus transactional delete/insert operations when replacement is requested.
   */
  async assignStaffToShift(
    organizationId: string,
    hotelId: string,
    shiftId: string,
    input: AssignShiftStaffInput
  ): Promise<HousekeepingShiftResponse> {
    const shift = await this.housekeepingRepo.findShiftById(shiftId, organizationId, hotelId);

    if (!shift) {
      throw new NotFoundError('Shift not found');
    }

    const staffIds = Array.from(new Set(input.staffIds));

    if (staffIds.length === 0) {
      throw new BadRequestError('At least one staff member is required');
    }

    const staff = await prisma.user.findMany({
      where: {
        id: { in: staffIds },
        organizationId,
        status: 'ACTIVE',
        deletedAt: null,
      },
      select: { id: true },
    });

    if (staff.length !== staffIds.length) {
      throw new NotFoundError('One or more staff members were not found or are inactive');
    }

    await prisma.$transaction(async (tx) => {
      if (input.replaceExisting) {
        await tx.housekeepingShiftAssignment.deleteMany({
          where: { shiftId: shift.id },
        });
      }

      await tx.housekeepingShiftAssignment.createMany({
        data: staffIds.map((staffId) => ({
          organizationId,
          hotelId,
          shiftId: shift.id,
          staffId,
          role: input.role ?? null,
        })),
        skipDuplicates: true,
      });
    });

    const updated = await this.housekeepingRepo.findShiftById(shift.id, organizationId, hotelId);

    if (!updated) {
      throw new NotFoundError('Shift not found after staff assignment');
    }

    return this.mapShift(updated);
  }

  /**
   * Computes per-staff workload metrics from assigned tasks and active shift assignments.
   *
   * Aggregates daily task and shift records into per-staff buckets, derives counts and average task
   * duration, enriches with user display names, and returns workload rows ordered by task volume.
   *
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @param date - Optional business date; defaults to current UTC day.
   * @returns Staff workload metrics including assignment, completion, shift, and timing summaries.
   * @remarks Complexity: O(t + a + s log s) where t is task count, a is shift assignment count, and s is distinct staff IDs.
   */
  async getStaffWorkload(
    organizationId: string,
    hotelId: string,
    date?: Date
  ): Promise<StaffWorkloadItem[]> {
    const workloadDate = this.asDateOnly(date ?? new Date());

    const [tasks, shiftAssignments] = await Promise.all([
      prisma.housekeepingTask.findMany({
        where: {
          organizationId,
          hotelId,
          scheduledFor: workloadDate,
          assignedTo: { not: null },
        },
        select: {
          assignedTo: true,
          status: true,
          actualMinutes: true,
        },
      }),
      this.housekeepingRepo.countActiveShiftAssignmentsForDate(
        organizationId,
        hotelId,
        workloadDate
      ),
    ]);

    const accumulator = new Map<
      string,
      {
        assignedTasks: number;
        inProgressTasks: number;
        completedTasks: number;
        activeShifts: number;
        totalMinutes: number;
        minuteEntries: number;
      }
    >();

    /**
     * Returns the mutable accumulator bucket for a staff member, creating one when absent.
     *
     * @param staffId - Staff UUID used as the aggregation key.
     * @returns Existing or newly initialized workload bucket for the staff member.
     */
    const ensure = (staffId: string) => {
      const existing = accumulator.get(staffId);
      if (existing) {
        return existing;
      }

      const created = {
        assignedTasks: 0,
        inProgressTasks: 0,
        completedTasks: 0,
        activeShifts: 0,
        totalMinutes: 0,
        minuteEntries: 0,
      };

      accumulator.set(staffId, created);

      return created;
    };

    for (const task of tasks) {
      if (!task.assignedTo) {
        continue;
      }

      const bucket = ensure(task.assignedTo);
      bucket.assignedTasks += 1;

      if (task.status === 'IN_PROGRESS') {
        bucket.inProgressTasks += 1;
      }

      if (task.status === 'COMPLETED' || task.status === 'VERIFIED') {
        bucket.completedTasks += 1;
      }

      if (typeof task.actualMinutes === 'number' && Number.isFinite(task.actualMinutes)) {
        bucket.totalMinutes += task.actualMinutes;
        bucket.minuteEntries += 1;
      }
    }

    for (const assignment of shiftAssignments) {
      const bucket = ensure(assignment.staffId);
      bucket.activeShifts += 1;
    }

    const staffIds = Array.from(accumulator.keys());

    if (staffIds.length === 0) {
      return [];
    }

    const staff = await prisma.user.findMany({
      where: {
        id: { in: staffIds },
        organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    });

    const namesById = new Map(staff.map((item) => [item.id, `${item.firstName} ${item.lastName}`]));

    return staffIds
      .map((staffId) => {
        const bucket = accumulator.get(staffId);

        if (!bucket) {
          return {
            staffId,
            staffName: namesById.get(staffId) ?? 'Unknown Staff',
            assignedTasks: 0,
            inProgressTasks: 0,
            completedTasks: 0,
            averageMinutesPerTask: 0,
            activeShifts: 0,
          };
        }

        return {
          staffId,
          staffName: namesById.get(staffId) ?? 'Unknown Staff',
          assignedTasks: bucket.assignedTasks,
          inProgressTasks: bucket.inProgressTasks,
          completedTasks: bucket.completedTasks,
          averageMinutesPerTask:
            bucket.minuteEntries === 0
              ? 0
              : Number((bucket.totalMinutes / bucket.minuteEntries).toFixed(2)),
          activeShifts: bucket.activeShifts,
        };
      })
      .sort((left, right) => {
        if (right.assignedTasks !== left.assignedTasks) {
          return right.assignedTasks - left.assignedTasks;
        }

        return left.staffName.localeCompare(right.staffName);
      });
  }

  /**
   * Builds a housekeeping dashboard snapshot for tasks, shifts, lost-and-found, and inspections.
   *
   * Executes grouped status/outcome queries for a UTC business date window, folds group counts into
   * dashboard buckets, and computes inspection pass rate from passed versus failed totals.
   *
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @param date - Optional business date; defaults to current UTC day.
   * @returns Dashboard response with per-domain counters and inspection pass-rate percentage.
   * @remarks Complexity: O(g) post-query aggregation where g is total group rows returned across the four groupBy queries.
   */
  async getDashboard(
    organizationId: string,
    hotelId: string,
    date?: Date
  ): Promise<HousekeepingDashboardResponse> {
    const dashboardDate = this.asDateOnly(date ?? new Date());
    const dayStart = new Date(
      Date.UTC(
        dashboardDate.getUTCFullYear(),
        dashboardDate.getUTCMonth(),
        dashboardDate.getUTCDate(),
        0,
        0,
        0,
        0
      )
    );
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const [taskGroups, shiftGroups, lostFoundGroups, inspectionGroups] = await Promise.all([
      prisma.housekeepingTask.groupBy({
        by: ['status'],
        where: {
          organizationId,
          hotelId,
          scheduledFor: dashboardDate,
        },
        _count: { _all: true },
      }),
      prisma.housekeepingShift.groupBy({
        by: ['status'],
        where: {
          organizationId,
          hotelId,
          shiftDate: dashboardDate,
        },
        _count: { _all: true },
      }),
      prisma.lostFoundItem.groupBy({
        by: ['status'],
        where: {
          organizationId,
          hotelId,
          foundAt: {
            gte: dayStart,
            lt: dayEnd,
          },
        },
        _count: { _all: true },
      }),
      prisma.housekeepingInspection.groupBy({
        by: ['outcome'],
        where: {
          organizationId,
          hotelId,
          createdAt: {
            gte: dayStart,
            lt: dayEnd,
          },
        },
        _count: { _all: true },
      }),
    ]);

    const tasks = {
      total: 0,
      pending: 0,
      inProgress: 0,
      completed: 0,
      verified: 0,
      issues: 0,
      dnd: 0,
      cancelled: 0,
    };

    for (const group of taskGroups) {
      const count = group._count._all;
      tasks.total += count;

      if (group.status === 'PENDING') tasks.pending = count;
      if (group.status === 'IN_PROGRESS') tasks.inProgress = count;
      if (group.status === 'COMPLETED') tasks.completed = count;
      if (group.status === 'VERIFIED') tasks.verified = count;
      if (group.status === 'ISSUES_REPORTED') tasks.issues = count;
      if (group.status === 'DND') tasks.dnd = count;
      if (group.status === 'CANCELLED') tasks.cancelled = count;
    }

    const shifts = {
      planned: 0,
      active: 0,
      completed: 0,
      cancelled: 0,
    };

    for (const group of shiftGroups) {
      const count = group._count._all;

      if (group.status === 'PLANNED') shifts.planned = count;
      if (group.status === 'ACTIVE') shifts.active = count;
      if (group.status === 'COMPLETED') shifts.completed = count;
      if (group.status === 'CANCELLED') shifts.cancelled = count;
    }

    const lostFound = {
      reported: 0,
      stored: 0,
      claimed: 0,
      disposed: 0,
    };

    for (const group of lostFoundGroups) {
      const count = group._count._all;

      if (group.status === 'REPORTED') lostFound.reported = count;
      if (group.status === 'STORED') lostFound.stored = count;
      if (group.status === 'CLAIMED') lostFound.claimed = count;
      if (group.status === 'DISPOSED') lostFound.disposed = count;
    }

    let passed = 0;
    let failed = 0;

    for (const group of inspectionGroups) {
      const count = group._count._all;

      if (group.outcome === 'PASSED') passed = count;
      if (group.outcome === 'FAILED') failed = count;
    }

    return {
      date: dashboardDate.toISOString().slice(0, 10),
      tasks,
      shifts,
      lostFound,
      inspections: {
        passed,
        failed,
        passRate:
          passed + failed === 0 ? 0 : Number(((passed / (passed + failed)) * 100).toFixed(2)),
      },
    };
  }

  /**
   * Creates a lost-and-found item after optional room scope validation.
   *
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @param input - Item creation payload with discovery, custody, and optional guest data.
   * @param userId - Optional finder UUID; defaults to system actor when omitted.
   * @returns Created lost-and-found item mapped to API response shape.
   * @throws {NotFoundError} When a provided room is not found in scope.
   */
  async createLostFoundItem(
    organizationId: string,
    hotelId: string,
    input: CreateLostFoundItemInput,
    userId?: string
  ): Promise<LostFoundItemResponse> {
    if (input.roomId) {
      const room = await prisma.room.findFirst({
        where: {
          id: input.roomId,
          organizationId,
          hotelId,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (!room) {
        throw new NotFoundError('Room not found in this hotel');
      }
    }

    const item = await this.housekeepingRepo.createLostFoundItem({
      organizationId,
      hotelId,
      roomId: input.roomId ?? null,
      itemName: input.itemName,
      category: input.category,
      description: input.description ?? null,
      locationFound: input.locationFound,
      foundBy: userId ?? SYSTEM_ACTOR_ID,
      foundAt: input.foundAt ?? new Date(),
      status: 'REPORTED',
      storageLocation: input.storageLocation ?? null,
      custodyNotes: input.custodyNotes ?? null,
      guestId: input.guestId ?? null,
    });

    return this.mapLostFoundItem(item);
  }

  /**
   * Lists lost-and-found items with filters and pagination.
   *
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @param filters - Lost-and-found filters for status, category, room, and date range.
   * @param pagination - Pagination controls containing page and page-size values.
   * @returns Mapped lost-and-found items plus total count.
   */
  async listLostFoundItems(
    organizationId: string,
    hotelId: string,
    filters: LostFoundQueryFilters,
    pagination: { page: number; limit: number }
  ) {
    const { items, total } = await this.housekeepingRepo.listLostFoundItems(
      organizationId,
      hotelId,
      filters,
      pagination
    );

    return {
      items: items.map((item) => this.mapLostFoundItem(item)),
      total,
    };
  }

  /**
   * Retrieves one lost-and-found item by identifier.
   *
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @param itemId - Lost-and-found item UUID.
   * @returns Item response for the requested identifier.
   * @throws {NotFoundError} When no scoped item exists.
   */
  async getLostFoundItemDetail(
    organizationId: string,
    hotelId: string,
    itemId: string
  ): Promise<LostFoundItemResponse> {
    const item = await this.housekeepingRepo.findLostFoundItemById(itemId, organizationId, hotelId);

    if (!item) {
      throw new NotFoundError('Lost and found item not found');
    }

    return this.mapLostFoundItem(item);
  }

  /**
   * Updates lost-and-found custody status while enforcing claim and disposal rules.
   *
   * Prevents status reversal after disposal, requires claimant data before `CLAIMED`, requires disposal
   * method before `DISPOSED`, and auto-stamps claim/disposal timestamps when a first transition occurs.
   *
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @param itemId - Lost-and-found item UUID to modify.
   * @param input - Partial update payload for status and custody fields.
   * @returns Updated lost-and-found item response.
   * @throws {NotFoundError} When the scoped item cannot be found.
   * @throws {BadRequestError} When transitions violate disposal or required-field rules.
   */
  async updateLostFoundItem(
    organizationId: string,
    hotelId: string,
    itemId: string,
    input: UpdateLostFoundItemInput
  ): Promise<LostFoundItemResponse> {
    const item = await this.housekeepingRepo.findLostFoundItemById(itemId, organizationId, hotelId);

    if (!item) {
      throw new NotFoundError('Lost and found item not found');
    }

    if (item.status === 'DISPOSED' && input.status !== undefined && input.status !== 'DISPOSED') {
      throw new BadRequestError('A disposed item cannot transition to another status');
    }

    if (input.status === 'CLAIMED' && !(input.claimedByName ?? item.claimedByName)) {
      throw new BadRequestError('claimedByName is required when marking an item as CLAIMED');
    }

    if (input.status === 'DISPOSED' && !(input.disposalMethod ?? item.disposalMethod)) {
      throw new BadRequestError('disposalMethod is required when marking an item as DISPOSED');
    }

    const nextStatus = input.status ?? item.status;

    const updated = await this.housekeepingRepo.updateLostFoundItem(item.id, {
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.storageLocation !== undefined ? { storageLocation: input.storageLocation } : {}),
      ...(input.custodyNotes !== undefined ? { custodyNotes: input.custodyNotes } : {}),
      ...(input.claimedByName !== undefined ? { claimedByName: input.claimedByName } : {}),
      ...(input.claimedAt !== undefined ? { claimedAt: input.claimedAt } : {}),
      ...(input.disposedAt !== undefined ? { disposedAt: input.disposedAt } : {}),
      ...(input.disposalMethod !== undefined ? { disposalMethod: input.disposalMethod } : {}),
      ...(nextStatus === 'CLAIMED' && item.claimedAt === null && input.claimedAt === undefined
        ? { claimedAt: new Date() }
        : {}),
      ...(nextStatus === 'DISPOSED' && item.disposedAt === null && input.disposedAt === undefined
        ? { disposedAt: new Date() }
        : {}),
    });

    return this.mapLostFoundItem(updated);
  }

  /**
   * Logs a lost-and-found owner notification attempt and returns dispatch metadata.
   *
   * @param organizationId - Organization UUID used for tenant scoping.
   * @param hotelId - Hotel UUID used for property scoping.
   * @param itemId - Lost-and-found item UUID being communicated about.
   * @param input - Notification payload including message and optional channel.
   * @param userId - Optional sender UUID; defaults to system actor when omitted.
   * @returns Notification acknowledgement payload with channel, sender, and timestamp.
   * @throws {NotFoundError} When the scoped item cannot be found.
   */
  async notifyLostFoundOwner(
    organizationId: string,
    hotelId: string,
    itemId: string,
    input: NotifyLostFoundInput,
    userId?: string
  ) {
    const item = await this.housekeepingRepo.findLostFoundItemById(itemId, organizationId, hotelId);

    if (!item) {
      throw new NotFoundError('Lost and found item not found');
    }

    logger.info('Lost and found owner notification logged', {
      itemId,
      hotelId,
      organizationId,
      channel: input.channel ?? 'EMAIL',
      sentBy: userId ?? SYSTEM_ACTOR_ID,
      messagePreview: input.message.slice(0, 120),
    });

    return {
      itemId: item.id,
      channel: input.channel ?? 'EMAIL',
      sent: true,
      sentAt: new Date(),
      sentBy: userId ?? SYSTEM_ACTOR_ID,
      status: item.status,
    };
  }

  /**
   * Calculates a rounded weighted inspection score from per-category values.
   *
   * @param scores - Category score map used with configured inspection weights.
   * @returns Rounded weighted total score.
   */
  calculateInspectionScore(scores: InspectionScores): number {
    const weightedScore = Object.entries(INSPECTION_WEIGHTS).reduce((sum, [key, weight]) => {
      const value = scores[key as keyof InspectionScores] ?? 0;
      return sum + value * weight;
    }, 0);

    return Math.round(weightedScore);
  }

  /**
   * Determines whether any inspection category breaches the auto-fail threshold.
   *
   * @param scores - Category score map to evaluate.
   * @returns True when at least one category score is below 50.
   */
  hasAutoFailCategory(scores: InspectionScores): boolean {
    return Object.values(scores).some((value) => value < 50);
  }

  /**
   * Normalizes a timestamp to a UTC date-only value at midnight.
   *
   * @param value - Source timestamp to normalize.
   * @returns UTC midnight date preserving year, month, and day components.
   */
  private asDateOnly(value: Date): Date {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }

  /**
   * Serializes structured inspection failure items into a compact audit string.
   *
   * @param failureItems - Optional failure item list containing area, issue, and severity.
   * @returns Semicolon-delimited failure summary string, or null when no items are provided.
   */
  private serializeFailureItems(
    failureItems?: Array<{ area: keyof InspectionScores; issue: string; severity: string }>
  ): string | null {
    if (!failureItems || failureItems.length === 0) {
      return null;
    }

    return failureItems.map((item) => `[${item.area}] ${item.issue} (${item.severity})`).join('; ');
  }

  /**
   * Converts unknown persisted score JSON into a complete `InspectionScores` object.
   *
   * @param value - Raw score payload from persistence.
   * @returns Normalized score object with numeric values for every category.
   */
  private normalizeScores(value: unknown): InspectionScores {
    const fallback: InspectionScores = {
      bedding: 0,
      bathroom: 0,
      floors: 0,
      amenities: 0,
      furniture: 0,
      general: 0,
    };

    if (!value || typeof value !== 'object') {
      return fallback;
    }

    const record = value as Record<string, unknown>;

    return {
      bedding: Number(record['bedding'] ?? 0),
      bathroom: Number(record['bathroom'] ?? 0),
      floors: Number(record['floors'] ?? 0),
      amenities: Number(record['amenities'] ?? 0),
      furniture: Number(record['furniture'] ?? 0),
      general: Number(record['general'] ?? 0),
    };
  }

  /**
   * Computes rounded average inspection scores per category.
   *
   * @param scoresList - Collection of raw score payloads to aggregate.
   * @returns Category averages, or zeroed values when the input list is empty.
   * @remarks Complexity: O(n) where n is number of score payloads.
   */
  private computeCategoryAverages(scoresList: unknown[]): InspectionScores {
    const base: InspectionScores = {
      bedding: 0,
      bathroom: 0,
      floors: 0,
      amenities: 0,
      furniture: 0,
      general: 0,
    };

    if (scoresList.length === 0) {
      return base;
    }

    for (const rawScores of scoresList) {
      const scores = this.normalizeScores(rawScores);
      base.bedding += scores.bedding;
      base.bathroom += scores.bathroom;
      base.floors += scores.floors;
      base.amenities += scores.amenities;
      base.furniture += scores.furniture;
      base.general += scores.general;
    }

    return {
      bedding: Math.round(base.bedding / scoresList.length),
      bathroom: Math.round(base.bathroom / scoresList.length),
      floors: Math.round(base.floors / scoresList.length),
      amenities: Math.round(base.amenities / scoresList.length),
      furniture: Math.round(base.furniture / scoresList.length),
      general: Math.round(base.general / scoresList.length),
    };
  }

  /**
   * Identifies the lowest-scoring inspection category.
   *
   * @param scores - Category average scores.
   * @returns Category key with the lowest value, defaulting to `amenities` when empty.
   */
  private findWeakArea(scores: InspectionScores): keyof InspectionScores {
    const entries = Object.entries(scores) as Array<[keyof InspectionScores, number]>;
    entries.sort((left, right) => left[1] - right[1]);
    return entries[0]?.[0] ?? 'amenities';
  }

  /**
   * Classifies score trajectory as improving, declining, or stable.
   *
   * @param values - Ordered score series with newest values first.
   * @returns Trend classification based on half-window average delta.
   */
  private computeTrend(values: number[]): 'IMPROVING' | 'DECLINING' | 'STABLE' {
    if (values.length < 4) {
      return 'STABLE';
    }

    const midpoint = Math.floor(values.length / 2);
    const firstHalf = values.slice(midpoint);
    const secondHalf = values.slice(0, midpoint);

    const firstAverage = firstHalf.reduce((sum, value) => sum + value, 0) / firstHalf.length;
    const secondAverage = secondHalf.reduce((sum, value) => sum + value, 0) / secondHalf.length;

    const delta = secondAverage - firstAverage;

    if (delta >= 2) {
      return 'IMPROVING';
    }

    if (delta <= -2) {
      return 'DECLINING';
    }

    return 'STABLE';
  }

  /**
   * Maps a persistence task record to the public housekeeping task response contract.
   *
   * @param task - Raw task row with DB-oriented field types.
   * @returns API response object with typed task and status literals.
   */
  private mapTask(task: {
    id: string;
    organizationId: string;
    hotelId: string;
    roomId: string;
    taskType: string;
    status: string;
    priority: number;
    assignedTo: string | null;
    assignedAt: Date | null;
    scheduledFor: Date;
    estimatedMinutes: number;
    actualMinutes: number | null;
    startedAt: Date | null;
    completedAt: Date | null;
    verifiedAt: Date | null;
    verifiedBy: string | null;
    completionNotes: string | null;
    completionPhotos: unknown;
    suppliesUsed: unknown;
    inspectionScore: number | null;
    issuesFound: string | null;
    dndAt: Date | null;
    dndBy: string | null;
    dndReason: string | null;
    cancelledAt: Date | null;
    cancelledBy: string | null;
    cancellationReason: string | null;
    notes: string | null;
    guestRequests: string | null;
    createdAt: Date;
    createdBy: string;
  }): HousekeepingTaskResponse {
    return {
      id: task.id,
      organizationId: task.organizationId,
      hotelId: task.hotelId,
      roomId: task.roomId,
      taskType: task.taskType as HousekeepingTaskResponse['taskType'],
      status: task.status as HousekeepingTaskResponse['status'],
      priority: task.priority,
      assignedTo: task.assignedTo,
      assignedAt: task.assignedAt,
      scheduledFor: task.scheduledFor,
      estimatedMinutes: task.estimatedMinutes,
      actualMinutes: task.actualMinutes,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      verifiedAt: task.verifiedAt,
      verifiedBy: task.verifiedBy,
      completionNotes: task.completionNotes,
      completionPhotos: task.completionPhotos,
      suppliesUsed: task.suppliesUsed,
      inspectionScore: task.inspectionScore,
      issuesFound: task.issuesFound,
      dndAt: task.dndAt,
      dndBy: task.dndBy,
      dndReason: task.dndReason,
      cancelledAt: task.cancelledAt,
      cancelledBy: task.cancelledBy,
      cancellationReason: task.cancellationReason,
      notes: task.notes,
      guestRequests: task.guestRequests,
      createdAt: task.createdAt,
      createdBy: task.createdBy,
    };
  }

  /**
   * Maps a persistence inspection record to the public inspection response contract.
   *
   * @param inspection - Raw inspection row with JSON score/failure payloads.
   * @returns API response object with normalized scores and typed outcome fields.
   */
  private mapInspection(inspection: {
    id: string;
    organizationId: string;
    hotelId: string;
    taskId: string;
    roomId: string;
    staffId: string | null;
    inspectedBy: string;
    scores: unknown;
    overallScore: number;
    outcome: string;
    autoFailed: boolean;
    failureItems: unknown;
    feedbackToStaff: string | null;
    requiresMaintenance: boolean;
    maintenanceRequestId: string | null;
    createdAt: Date;
  }): HousekeepingInspectionResponse {
    const failureItems = Array.isArray(inspection.failureItems) ? inspection.failureItems : [];

    return {
      id: inspection.id,
      organizationId: inspection.organizationId,
      hotelId: inspection.hotelId,
      taskId: inspection.taskId,
      roomId: inspection.roomId,
      staffId: inspection.staffId,
      inspectedBy: inspection.inspectedBy,
      scores: this.normalizeScores(inspection.scores),
      overallScore: inspection.overallScore,
      outcome: inspection.outcome as HousekeepingInspectionResponse['outcome'],
      autoFailed: inspection.autoFailed,
      failureItems: failureItems as HousekeepingInspectionResponse['failureItems'],
      feedbackToStaff: inspection.feedbackToStaff,
      requiresMaintenance: inspection.requiresMaintenance,
      maintenanceRequestId: inspection.maintenanceRequestId,
      createdAt: inspection.createdAt,
    };
  }

  /**
   * Maps a persistence shift record to the public shift response contract.
   *
   * @param shift - Raw shift row including assignment children.
   * @returns API response object with typed status and assignment items.
   */
  private mapShift(shift: {
    id: string;
    organizationId: string;
    hotelId: string;
    shiftDate: Date;
    startTime: Date;
    endTime: Date;
    status: string;
    supervisorId: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    assignments: Array<{
      id: string;
      staffId: string;
      role: string | null;
      createdAt: Date;
    }>;
  }): HousekeepingShiftResponse {
    return {
      id: shift.id,
      organizationId: shift.organizationId,
      hotelId: shift.hotelId,
      shiftDate: shift.shiftDate,
      startTime: shift.startTime,
      endTime: shift.endTime,
      status: shift.status as HousekeepingShiftResponse['status'],
      supervisorId: shift.supervisorId,
      notes: shift.notes,
      createdAt: shift.createdAt,
      updatedAt: shift.updatedAt,
      assignments: shift.assignments.map((assignment) => ({
        id: assignment.id,
        staffId: assignment.staffId,
        role: assignment.role,
        createdAt: assignment.createdAt,
      })),
    };
  }

  /**
   * Maps a persistence lost-and-found row to the public response contract.
   *
   * @param item - Raw lost-and-found row from persistence.
   * @returns API response object with typed lost-and-found status.
   */
  private mapLostFoundItem(item: {
    id: string;
    organizationId: string;
    hotelId: string;
    roomId: string | null;
    itemName: string;
    category: string;
    description: string | null;
    locationFound: string;
    foundBy: string;
    foundAt: Date;
    status: string;
    storageLocation: string | null;
    custodyNotes: string | null;
    guestId: string | null;
    claimedByName: string | null;
    claimedAt: Date | null;
    disposedAt: Date | null;
    disposalMethod: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): LostFoundItemResponse {
    return {
      id: item.id,
      organizationId: item.organizationId,
      hotelId: item.hotelId,
      roomId: item.roomId,
      itemName: item.itemName,
      category: item.category,
      description: item.description,
      locationFound: item.locationFound,
      foundBy: item.foundBy,
      foundAt: item.foundAt,
      status: item.status as LostFoundItemResponse['status'],
      storageLocation: item.storageLocation,
      custodyNotes: item.custodyNotes,
      guestId: item.guestId,
      claimedByName: item.claimedByName,
      claimedAt: item.claimedAt,
      disposedAt: item.disposedAt,
      disposalMethod: item.disposalMethod,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}

export const housekeepingService = new HousekeepingService();
