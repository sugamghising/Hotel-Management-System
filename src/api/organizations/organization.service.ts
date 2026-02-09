// src/features/organizations/organization.service.ts
import { ConflictError, NotFoundError, logger } from '../../core';
import { prisma } from '../../database/prisma';
import type { Prisma } from '../../generated/prisma';
import type {
  // Schema types
  OrganizationCreateInput,
  OrganizationUpdateInput,
} from './organization.dto';
import { OrganizationRepository } from './organization.repository';
import {
  type LimitValidationResult,
  // Types
  type Organization,
  type OrganizationFilters,
  type OrganizationFullStats,
  type OrganizationListResult,
  type OrganizationStats,
  type OrganizationWithCounts,
  SUBSCRIPTION_CONFIG,
  type SubscriptionTier,
  // Type guards
  isSubscriptionTier,
} from './organization.types';

export class OrganizationService {
  private organizationRepository: OrganizationRepository;

  constructor(organizationRepo: OrganizationRepository = new OrganizationRepository()) {
    this.organizationRepository = organizationRepo;
  }

  /**
   * Get all organizations with pagination and filters
   */
  async findAll(filters: OrganizationFilters): Promise<OrganizationListResult> {
    const { search, status, type, skip = 0, take = 10 } = filters;

    const where: Prisma.OrganizationWhereInput = {
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.subscriptionStatus = status;
    }

    if (type) {
      where.organizationType = type;
    }

    const [data, total] = await Promise.all([
      this.organizationRepository.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              hotels: true,
              users: true,
            },
          },
        },
      }) as Promise<OrganizationWithCounts[]>,
      this.organizationRepository.count(where),
    ]);

    logger.debug(`Found ${total} organizations`, { filters });

    return { data, total };
  }

  /**
   * Get single organization by ID
   */
  async findById(id: string): Promise<OrganizationWithCounts> {
    const org = (await this.organizationRepository.findById(id, {
      _count: {
        select: {
          hotels: true,
          users: true,
        },
      },
    })) as OrganizationWithCounts | null;

    if (!org || org.deletedAt) {
      throw new NotFoundError('Organization');
    }

    return org;
  }

  /**
   * Get organization by code
   */
  async findByCode(code: string): Promise<Organization | null> {
    return this.organizationRepository.findByCode(code);
  }

  /**
   * Create new organization with tier defaults
   */
  async create(data: OrganizationCreateInput): Promise<Organization> {
    // Validate code uniqueness
    const exists = await this.organizationRepository.existsByCode(data.code);
    if (exists) {
      throw new ConflictError(`Organization with code '${data.code}' already exists`);
    }

    // Apply tier defaults
    const tierConfig = SUBSCRIPTION_CONFIG[data.subscriptionTier];
    const createData: Prisma.OrganizationCreateInput = {
      code: data.code,
      name: data.name,
      legalName: data.legalName,
      organizationType: data.organizationType,
      taxId: data.taxId ?? null,
      email: data.email,
      phone: data.phone ?? null,
      website: data.website || null,
      logoUrl: data.logoUrl || null,

      // Subscription
      subscriptionTier: data.subscriptionTier,
      subscriptionStatus: 'ACTIVE',
      subscriptionStartDate: new Date(),
      subscriptionEndDate:
        data.subscriptionTier === 'TRIAL' ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : null,

      // Limits from tier or custom
      maxHotels: data.maxHotels ?? tierConfig.hotels,
      maxRooms: data.maxRooms ?? tierConfig.rooms,
      maxUsers: data.maxUsers ?? tierConfig.users,

      // Features
      enabledFeatures: data.enabledFeatures.length > 0 ? data.enabledFeatures : tierConfig.features,

      settings: (data.settings || {}) as Prisma.InputJsonValue,
      version: 1,
    };

    const org = await this.organizationRepository.create(createData);

    logger.info(`Organization created: ${org.code}`, {
      orgId: org.id,
      tier: org.subscriptionTier,
    });

    return org;
  }

  /**
   * Update organization
   */
  async update(id: string, data: OrganizationUpdateInput): Promise<Organization> {
    // Verify exists
    await this.findById(id);

    // Build update with only provided fields
    const updateData: Prisma.OrganizationUpdateInput = {
      updatedAt: new Date(),
      version: { increment: 1 },
    };

    // Only include defined fields
    const fields: (keyof OrganizationUpdateInput)[] = [
      'name',
      'legalName',
      'taxId',
      'email',
      'phone',
      'website',
      'logoUrl',
      'organizationType',
      'settings',
    ];

    for (const field of fields) {
      if (data[field] !== undefined) {
        (updateData as Record<string, unknown>)[field] = data[field] === '' ? null : data[field];
      }
    }

    const updated = await this.organizationRepository.update(id, updateData);

    logger.info(`Organization updated: ${updated.code}`, { orgId: id });

    return updated;
  }

  /**
   * Update subscription tier
   */
  async updateSubscription(
    id: string,
    tier: SubscriptionTier,
    customLimits?: { maxHotels: number; maxRooms: number; maxUsers: number }
  ): Promise<Organization> {
    if (!isSubscriptionTier(tier)) {
      throw new Error(`Invalid subscription tier: ${tier}`);
    }

    const org = await this.findById(id);
    const tierConfig = SUBSCRIPTION_CONFIG[tier];

    // Check downgrade constraints
    if (this.isDowngrade(org.subscriptionTier, tier)) {
      const canDowngrade = await this.validateDowngrade(org, tierConfig);
      if (!canDowngrade.valid) {
        throw new ConflictError(canDowngrade.message ?? 'Cannot downgrade subscription');
      }
    }

    const updateData: Prisma.OrganizationUpdateInput = {
      subscriptionTier: tier,
      subscriptionStatus: 'ACTIVE',
      maxHotels: customLimits?.maxHotels ?? tierConfig.hotels,
      maxRooms: customLimits?.maxRooms ?? tierConfig.rooms,
      maxUsers: customLimits?.maxUsers ?? tierConfig.users,
      enabledFeatures: tierConfig.features,
      updatedAt: new Date(),
      version: { increment: 1 },
    };

    // Reset trial end date if upgrading from trial
    if (org.subscriptionTier === 'TRIAL' && tier !== 'TRIAL') {
      updateData.subscriptionEndDate = null;
    }

    const updated = await this.organizationRepository.update(id, updateData);

    logger.info(`Subscription updated: ${org.code} -> ${tier}`, { orgId: id });

    return updated;
  }

  /**
   * Soft delete organization
   */
  async delete(id: string): Promise<{ id: string; deleted: boolean }> {
    const org = await this.findById(id);

    // Business rule: cannot delete with active hotels
    if (org._count.hotels > 0) {
      throw new ConflictError(`Cannot delete organization with ${org._count.hotels} active hotels`);
    }

    await this.organizationRepository.softDelete(id);

    logger.info(`Organization deleted: ${org.code}`, { orgId: id });

    return { id, deleted: true };
  }

  /**
   * Get comprehensive stats
   */
  async getStats(id: string): Promise<OrganizationStats> {
    const org = (await this.organizationRepository.getOrganizationStats(
      id
    )) as OrganizationFullStats | null;

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
   * Validate resource limits before creation
   */
  async validateLimits(
    orgId: string,
    resourceType: 'hotel' | 'user' | 'room',
    requestedCount: number = 1
  ): Promise<LimitValidationResult> {
    const org = await this.findById(orgId);

    let current: number;
    let max: number;

    switch (resourceType) {
      case 'hotel': {
        current = org._count.hotels;
        max = org.maxHotels;
        break;
      }
      case 'user': {
        current = org._count.users;
        max = org.maxUsers;
        break;
      }
      case 'room': {
        // Rooms are across all hotels, need separate query
        const roomCount = await prisma.room.count({
          where: {
            hotel: { organizationId: orgId },
            deletedAt: null,
          },
        });
        current = roomCount;
        max = org.maxRooms;
        break;
      }
      default:
        return { valid: false, message: 'Unknown resource type' };
    }

    if (current + requestedCount > max) {
      return {
        valid: false,
        message: `${resourceType} limit exceeded. Current: ${current}, Max: ${max}, Requested: ${requestedCount}`,
        current,
        max,
        requested: requestedCount,
      };
    }

    return { valid: true, current, max, requested: requestedCount };
  }

  /**
   * Check if user has feature access
   */
  async hasFeature(orgId: string, feature: string): Promise<boolean> {
    const org = await this.organizationRepository.findById(orgId);
    if (!org) return false;

    // Enterprise has all features
    if (org.subscriptionTier === 'ENTERPRISE') return true;

    const features = org.enabledFeatures;
    if (!features || !Array.isArray(features)) return false;
    return (features as string[]).includes(feature);
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private isDowngrade(current: SubscriptionTier, next: SubscriptionTier): boolean {
    const tiers: SubscriptionTier[] = ['TRIAL', 'BASIC', 'PRO', 'ENTERPRISE'];
    return tiers.indexOf(next) < tiers.indexOf(current);
  }

  private async validateDowngrade(
    org: OrganizationWithCounts,
    nextTier: (typeof SUBSCRIPTION_CONFIG)[SubscriptionTier]
  ): Promise<{ valid: boolean; message?: string }> {
    if (org._count.hotels > nextTier.hotels) {
      return {
        valid: false,
        message: `Cannot downgrade: ${org._count.hotels} hotels exceeds ${nextTier.hotels} limit`,
      };
    }
    if (org._count.users > nextTier.users) {
      return {
        valid: false,
        message: `Cannot downgrade: ${org._count.users} users exceeds ${nextTier.users} limit`,
      };
    }
    return { valid: true };
  }
}

export const organizationService = new OrganizationService();
