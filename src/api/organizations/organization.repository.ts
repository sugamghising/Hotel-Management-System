import { prisma } from '../../database/prisma';
import type { Prisma } from '../../generated/prisma';

export type OrganizationWhereInput = Prisma.OrganizationWhereInput;
export type OrganizationCreateInput = Prisma.OrganizationCreateInput;
export type OrganizationUpdateInput = Prisma.OrganizationUpdateInput;

export class OrganizationRepository {
  /**
   * Retrieves organizations using caller-provided query options.
   *
   * @param params - Prisma pagination, filter, sorting, and include options.
   * @returns Matching organizations for the requested page and filter scope.
   */
  async findMany(params: {
    skip?: number;
    take?: number;
    where?: OrganizationWhereInput;
    orderBy?: Prisma.OrganizationOrderByWithRelationInput;
    include?: Prisma.OrganizationInclude;
  }) {
    return prisma.organization.findMany({
      ...params,
    });
  }

  /**
   * Counts organizations that satisfy an optional filter.
   *
   * @param where - Optional Prisma filter; when omitted all organizations are counted.
   * @returns Number of organizations matching the filter.
   */
  async count(where?: OrganizationWhereInput): Promise<number> {
    if (where === undefined) {
      return prisma.organization.count();
    }
    return prisma.organization.count({ where });
  }

  /**
   * Finds an organization by its primary identifier.
   *
   * @param id - Organization UUID.
   * @param include - Optional relation graph to include in the result.
   * @returns The matching organization, or `null` when no row exists.
   */
  async findById(id: string, include?: Prisma.OrganizationInclude) {
    if (include === undefined) {
      return prisma.organization.findUnique({
        where: { id },
      });
    }
    return prisma.organization.findUnique({
      where: { id },
      include,
    });
  }

  /**
   * Finds an organization by its unique code.
   *
   * @param code - Organization code stored in the unique code column.
   * @returns The matching organization, or `null` when no row exists.
   */
  async findByCode(code: string) {
    return prisma.organization.findUnique({
      where: { code },
    });
  }

  /**
   * Finds the first organization that matches the supplied criteria.
   *
   * @param where - Prisma filter definition.
   * @returns The first matching organization in Prisma's default order, or `null`.
   */
  async findFirst(where: OrganizationWhereInput) {
    return prisma.organization.findFirst({ where });
  }

  /**
   * Creates a new organization row.
   *
   * @param data - Fully prepared organization create payload.
   * @returns The newly created organization.
   */
  async create(data: OrganizationCreateInput) {
    return prisma.organization.create({ data });
  }

  /**
   * Updates an organization by its identifier.
   *
   * @param id - Organization UUID to update.
   * @param data - Partial update payload.
   * @returns The updated organization.
   */
  async update(id: string, data: OrganizationUpdateInput) {
    return prisma.organization.update({
      where: { id },
      data,
    });
  }

  /**
   * Soft-deletes an organization by setting cancellation metadata.
   *
   * @param id - Organization UUID to mark as deleted.
   * @returns The updated organization row after soft deletion.
   */
  async softDelete(id: string) {
    return prisma.organization.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        subscriptionStatus: 'CANCELLED',
      },
    });
  }

  /**
   * Permanently deletes an organization row.
   *
   * @param id - Organization UUID to remove.
   * @returns The deleted organization record.
   */
  async delete(id: string) {
    return prisma.organization.delete({
      where: { id },
    });
  }

  /**
   * Checks whether an organization exists for a given code.
   *
   * @param code - Organization code to test.
   * @returns `true` when at least one organization row matches the code.
   */
  async existsByCode(code: string): Promise<boolean> {
    const count = await prisma.organization.count({
      where: { code },
    });
    return count > 0;
  }

  /**
   * Checks whether an organization exists for a given identifier.
   *
   * @param id - Organization UUID to test.
   * @returns `true` when the organization exists.
   */
  async existsById(id: string): Promise<boolean> {
    const count = await prisma.organization.count({
      where: { id },
    });
    return count > 0;
  }

  /**
   * Loads an organization with aggregate counts and hotel summary rows.
   *
   * The query enforces `deletedAt: null` and includes both `_count` aggregates
   * and a selected projection of related hotels so service-layer stats can be
   * built without extra round trips.
   *
   * @param id - Organization UUID.
   * @returns Organization data with counts and hotel list, or `null` when missing.
   * @remarks Complexity: O(h) in number of returned hotels, dominated by a single DB query.
   */
  async getOrganizationStats(id: string) {
    return prisma.organization.findUnique({
      where: { id, deletedAt: null },
      include: {
        _count: {
          select: {
            hotels: true,
            users: true,
            reservations: true,
          },
        },
        hotels: {
          select: {
            id: true,
            name: true,
            status: true,
            totalRooms: true,
          },
        },
      },
    });
  }

  /**
   * Runs a caller-provided unit of work inside a Prisma transaction.
   *
   * @param fn - Async callback that receives a transaction-scoped Prisma client.
   * @returns The callback result committed atomically when no error is thrown.
   */
  async transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(fn);
  }
}

// Export singleton instance
export const organizationRepository = new OrganizationRepository();
