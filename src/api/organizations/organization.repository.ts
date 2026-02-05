import { prisma } from '../../database/prisma';
import type { Prisma } from '../../generated/prisma';

export type OrganizationWhereInput = Prisma.OrganizationWhereInput;
export type OrganizationCreateInput = Prisma.OrganizationCreateInput;
export type OrganizationUpdateInput = Prisma.OrganizationUpdateInput;

export class OrganizationRepository {
  /**
   * Find all organizations with filtering and pagination
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
   * Count organizations matching criteria
   */
  async count(where?: OrganizationWhereInput): Promise<number> {
    if (where === undefined) {
      return prisma.organization.count();
    }
    return prisma.organization.count({ where });
  }

  /**
   * Find unique organization by ID
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
   * Find unique organization by code
   */
  async findByCode(code: string) {
    return prisma.organization.findUnique({
      where: { code },
    });
  }

  /**
   * Find first organization matching criteria
   */
  async findFirst(where: OrganizationWhereInput) {
    return prisma.organization.findFirst({ where });
  }

  /**
   * Create new organization
   */
  async create(data: OrganizationCreateInput) {
    return prisma.organization.create({ data });
  }

  /**
   * Update organization by ID
   */
  async update(id: string, data: OrganizationUpdateInput) {
    return prisma.organization.update({
      where: { id },
      data,
    });
  }

  /**
   * Soft delete organization by ID
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
   * Hard delete organization (use with caution)
   */
  async delete(id: string) {
    return prisma.organization.delete({
      where: { id },
    });
  }

  /**
   * Check if organization exists by code
   */
  async existsByCode(code: string): Promise<boolean> {
    const count = await prisma.organization.count({
      where: { code },
    });
    return count > 0;
  }

  /**
   * Check if organization exists by ID
   */
  async existsById(id: string): Promise<boolean> {
    const count = await prisma.organization.count({
      where: { id },
    });
    return count > 0;
  }

  /**
   * Get organization with full stats
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
   * Execute operations within a transaction
   */
  async transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(fn);
  }
}

// Export singleton instance
export const organizationRepository = new OrganizationRepository();
