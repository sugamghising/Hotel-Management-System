import { ConflictError, NotFoundError, logger } from '../../core';
import type { Prisma } from '../../generated/prisma';
import type { OrganizationCreateDTO, OrganizationUpdateDTO } from './organization.dto';
import { OrganizationRepository } from './organization.repository';

export class OrganizationService {
  private organizationRepository: OrganizationRepository;

  constructor(organizationRepo: OrganizationRepository = new OrganizationRepository()) {
    this.organizationRepository = organizationRepo;
  }

  /**
   * Get all organizations with pagination and filters
   */
  async findAll(query: {
    skip?: number;
    take?: number;
    search?: string;
    status?: string;
    type?: string;
  }) {
    try {
      const where: Record<string, unknown> = {
        deletedAt: null,
      };

      if (query.search) {
        where['OR'] = [
          { name: { contains: query.search, mode: 'insensitive' as const } },
          { code: { contains: query.search, mode: 'insensitive' as const } },
        ];
      }

      if (query.status) {
        where['subscriptionStatus'] = query.status;
      }

      if (query.type) {
        where['organizationType'] = query.type;
      }

      const [data, total] = await Promise.all([
        this.organizationRepository.findMany({
          where,
          skip: query.skip || 0,
          take: query.take || 10,
          orderBy: { createdAt: 'desc' },
          include: {
            _count: {
              select: {
                hotels: true,
                users: true,
              },
            },
          },
        }),
        this.organizationRepository.count(where),
      ]);

      logger.debug(`Found ${total} organizations`, { filters: query });

      return { data, total };
    } catch (error) {
      logger.error('Failed to fetch organizations', { error, query });
      throw error;
    }
  }

  /**
   * Get single organization by ID
   */
  async findById(id: string) {
    const org = await this.organizationRepository.findById(id, {
      _count: {
        select: {
          hotels: true,
          users: true,
        },
      },
    });

    if (!org || org.deletedAt) {
      throw new NotFoundError('Organization');
    }

    return org;
  }

  /**
   * Get organization by code
   */
  async findByCode(code: string) {
    return this.organizationRepository.findByCode(code);
  }

  /**
   * Create new organization
   */
  async create(data: OrganizationCreateDTO) {
    // Validate business rules
    const exists = await this.organizationRepository.existsByCode(data.code);
    if (exists) {
      throw new ConflictError(`Organization with code '${data.code}' already exists`);
    }

    // Set defaults and filter undefined values for Prisma
    const createData: Prisma.OrganizationCreateInput = {
      code: data.code,
      name: data.name,
      legalName: data.legalName,
      taxId: data.taxId ?? null,
      email: data.email,
      phone: data.phone ?? null,
      website: data.website || null,
      logoUrl: data.logoUrl || null,
      organizationType: data.organizationType,
      maxHotels: data.maxHotels,
      maxRooms: data.maxRooms,
      maxUsers: data.maxUsers,
      subscriptionTier: 'TRIAL' as const,
      subscriptionStatus: 'ACTIVE' as const,
      enabledFeatures: [],
      settings: (data.settings || {}) as Prisma.InputJsonValue,
      version: 1,
    };

    const org = await this.organizationRepository.create(createData);

    logger.info(`Organization created: ${org.code}`, { orgId: org.id });

    return org;
  }

  /**
   * Update organization
   */
  async update(id: string, data: OrganizationUpdateDTO) {
    // Verify organization exists and is not deleted
    await this.findById(id);

    // Filter undefined values and build update data
    const updateData: Prisma.OrganizationUpdateInput = {
      updatedAt: new Date(),
      version: { increment: 1 },
    };

    // Only include defined fields
    if (data.name !== undefined) updateData['name'] = data.name;
    if (data.legalName !== undefined) updateData['legalName'] = data.legalName;
    if (data.taxId !== undefined) updateData['taxId'] = data.taxId ?? null;
    if (data.email !== undefined) updateData['email'] = data.email;
    if (data.phone !== undefined) updateData['phone'] = data.phone ?? null;
    if (data.website !== undefined) updateData['website'] = data.website || null;
    if (data.logoUrl !== undefined) updateData['logoUrl'] = data.logoUrl || null;
    if (data.organizationType !== undefined) updateData['organizationType'] = data.organizationType;
    if (data.maxHotels !== undefined) updateData['maxHotels'] = data.maxHotels;
    if (data.maxRooms !== undefined) updateData['maxRooms'] = data.maxRooms;
    if (data.maxUsers !== undefined) updateData['maxUsers'] = data.maxUsers;
    if (data.settings !== undefined)
      updateData['settings'] = data.settings as Prisma.InputJsonValue;

    const updated = await this.organizationRepository.update(id, updateData);

    logger.info(`Organization updated: ${updated.code}`, { orgId: id });

    return updated;
  }

  /**
   * Soft delete organization
   */
  async delete(id: string) {
    // Verify exists
    await this.findById(id);

    // Check if organization has active hotels (business rule)
    type OrgWithCount = Prisma.OrganizationGetPayload<{
      include: { _count: { select: { hotels: true } } };
    }>;

    const orgWithHotels = (await this.organizationRepository.findById(id, {
      _count: { select: { hotels: true } },
    })) as OrgWithCount | null;

    if (orgWithHotels?._count?.hotels && orgWithHotels._count.hotels > 0) {
      throw new ConflictError(
        `Cannot delete organization with ${orgWithHotels._count.hotels} active hotels. Please delete or transfer hotels first.`
      );
    }

    await this.organizationRepository.softDelete(id);

    logger.info(`Organization soft deleted: ${id}`);

    return { id, deleted: true };
  }

  /**
   * Get organization statistics
   */
  async getStats(id: string) {
    type OrgWithStats = Prisma.OrganizationGetPayload<{
      include: {
        _count: { select: { hotels: true; users: true; reservations: true } };
        hotels: { select: { id: true; name: true; status: true; totalRooms: true } };
      };
    }>;

    const org = (await this.organizationRepository.getOrganizationStats(id)) as OrgWithStats | null;

    if (!org) {
      throw new NotFoundError('Organization');
    }

    return {
      id: org.id,
      name: org.name,
      code: org.code,
      stats: {
        totalHotels: org._count.hotels,
        totalUsers: org._count.users,
        totalReservations: org._count.reservations,
        hotels: org.hotels.map((h) => ({
          id: h.id,
          name: h.name,
          status: h.status,
          totalRooms: h.totalRooms,
        })),
      },
      subscription: {
        tier: org.subscriptionTier,
        status: org.subscriptionStatus,
        maxHotels: org.maxHotels,
        maxRooms: org.maxRooms,
        maxUsers: org.maxUsers,
        startDate: org.subscriptionStartDate,
        endDate: org.subscriptionEndDate,
      },
      usage: {
        hotelsUsed: org._count.hotels,
        hotelsRemaining: org.maxHotels - org._count.hotels,
        usersUsed: org._count.users,
        usersRemaining: org.maxUsers - org._count.users,
      },
    };
  }

  /**
   * Validate organization limits before creating resources
   */
  async validateLimits(
    orgId: string,
    resourceType: 'hotel' | 'user' | 'room',
    requestedCount: number = 1
  ): Promise<{ valid: boolean; message?: string }> {
    type OrgWithCount = Prisma.OrganizationGetPayload<{
      include: { _count: { select: { hotels: true; users: true } } };
    }>;

    const org = (await this.organizationRepository.findById(orgId, {
      _count: {
        select: {
          hotels: true,
          users: true,
        },
      },
    })) as OrgWithCount | null;

    if (!org) {
      throw new NotFoundError('Organization');
    }

    switch (resourceType) {
      case 'hotel':
        if (org._count.hotels + requestedCount > org.maxHotels) {
          return {
            valid: false,
            message: `Hotel limit exceeded. Current: ${org._count.hotels}, Max: ${org.maxHotels}, Requested: ${requestedCount}`,
          };
        }
        break;
      case 'user':
        if (org._count.users + requestedCount > org.maxUsers) {
          return {
            valid: false,
            message: `User limit exceeded. Current: ${org._count.users}, Max: ${org.maxUsers}, Requested: ${requestedCount}`,
          };
        }
        break;
      default:
        break;
    }

    return { valid: true };
  }
}

export const organizationService = new OrganizationService();
