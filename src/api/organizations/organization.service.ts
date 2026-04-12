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

  /**
   * Creates an organization service with an optional repository override.
   *
   * @param organizationRepo - Repository instance used for organization persistence.
   */
  constructor(organizationRepo: OrganizationRepository = new OrganizationRepository()) {
    this.organizationRepository = organizationRepo;
  }

  /**
   * Lists non-deleted organizations with filter and pagination support.
   *
   * Builds a Prisma `where` clause from search text, subscription status, and
   * organization type, then fetches both result rows and total count in
   * parallel so callers can render paginated responses.
   *
   * @param filters - Search and pagination options for organization listing.
   * @returns A paginated organization list plus total row count.
   * @remarks Complexity: O(n) in returned page size; performs two database queries.
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
   * Retrieves a single active organization by identifier including counts.
   *
   * @param id - Organization UUID.
   * @returns Organization with hotel and user counts.
   * @throws {NotFoundError} Thrown when the organization does not exist or is soft-deleted.
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
   * Retrieves an organization by code.
   *
   * @param code - Unique organization code.
   * @returns Matching organization, or `null` when the code is unknown.
   */
  async findByCode(code: string): Promise<Organization | null> {
    return this.organizationRepository.findByCode(code);
  }

  /**
   * Creates an organization and applies defaults from the selected subscription tier.
   *
   * The method first enforces code uniqueness, then merges caller-provided
   * limits and features with tier defaults from `SUBSCRIPTION_CONFIG`. Trial
   * organizations get an automatic 14-day end date; non-trial tiers default to
   * no subscription end date.
   *
   * @param data - Organization creation payload from API validation.
   * @returns The newly created organization entity.
   * @throws {ConflictError} Thrown when an organization with the same code already exists.
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
   * Updates mutable organization profile fields and bumps row version.
   *
   * Verifies the organization exists, builds a patch object from defined input
   * fields only, and normalizes empty-string values to `null` for nullable
   * columns before persisting.
   *
   * @param id - Organization UUID to update.
   * @param data - Partial organization update payload.
   * @returns The updated organization.
   * @throws {NotFoundError} Thrown when the organization cannot be found.
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
   * Changes subscription tier and recalculates organization limits.
   *
   * Validates the target tier, checks downgrade safety against current hotel
   * and user usage, applies either custom limits or tier defaults, and clears
   * trial end dates when moving away from `'TRIAL'`.
   *
   * @param id - Organization UUID to update.
   * @param tier - Target subscription tier.
   * @param customLimits - Optional explicit limits overriding tier defaults.
   * @returns The updated organization with new subscription settings.
   * @throws {Error} Thrown when `tier` is not a recognized subscription tier.
   * @throws {NotFoundError} Thrown when the organization cannot be found.
   * @throws {ConflictError} Thrown when downgrade constraints are violated.
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
   * Soft-deletes an organization after enforcing business constraints.
   *
   * The delete is rejected when active hotels are still associated with the
   * organization to prevent orphaned hotel data.
   *
   * @param id - Organization UUID to delete.
   * @returns A confirmation payload containing the deleted identifier.
   * @throws {NotFoundError} Thrown when the organization cannot be found.
   * @throws {ConflictError} Thrown when the organization still has active hotels.
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
   * Builds a comprehensive organization stats view for dashboards.
   *
   * Reads organization counts and hotel summaries from the repository and maps
   * them into API-facing `stats`, `subscription`, and `usage` structures with
   * precomputed remaining capacity metrics.
   *
   * @param id - Organization UUID.
   * @returns Aggregated organization statistics payload.
   * @throws {NotFoundError} Thrown when the organization does not exist.
   * @remarks Complexity: O(h) in number of returned hotels.
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
   * Validates whether creating additional resources would exceed plan limits.
   *
   * Uses organization counts for hotels/users and performs an additional room
   * count query for room checks. Returns a structured response instead of
   * throwing so callers can decide how to surface limit failures.
   *
   * @param orgId - Organization UUID.
   * @param resourceType - Resource category to validate (`'hotel'`, `'user'`, or `'room'`).
   * @param requestedCount - Number of new resources requested.
   * @returns Validation result containing current usage, limits, and status.
   * @throws {NotFoundError} Thrown when the organization cannot be found.
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
   * Checks whether an organization has access to a named feature.
   *
   * Enterprise organizations always return access. For other tiers the method
   * expects `enabledFeatures` to be an array and checks for direct membership.
   *
   * @param orgId - Organization UUID.
   * @param feature - Feature key to test.
   * @returns `true` when the feature is available for the organization.
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

  /**
   * Determines whether moving from the current tier to the next tier is a downgrade.
   *
   * @param current - Current subscription tier.
   * @param next - Requested subscription tier.
   * @returns `true` when `next` has lower rank than `current`.
   */
  private isDowngrade(current: SubscriptionTier, next: SubscriptionTier): boolean {
    const tiers: SubscriptionTier[] = ['TRIAL', 'BASIC', 'PRO', 'ENTERPRISE'];
    return tiers.indexOf(next) < tiers.indexOf(current);
  }

  /**
   * Verifies that current usage fits within a target tier's limits.
   *
   * @param org - Organization with current hotel/user counts.
   * @param nextTier - Target tier limit configuration.
   * @returns Validation result with an explanatory message when invalid.
   */
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
