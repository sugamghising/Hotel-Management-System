// src/features/organizations/organization.types.ts
import type { Prisma } from '../../generated/prisma';
import type { JsonValue } from '../../generated/prisma/runtime/client';

// ============================================================================
// ENUMS (Mirror Prisma but with explicit control)
// ============================================================================

export type OrganizationType = 'CHAIN' | 'INDEPENDENT';
export type SubscriptionTier = 'TRIAL' | 'BASIC' | 'PRO' | 'ENTERPRISE';
export type SubscriptionStatus = 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'EXPIRED';

// ============================================================================
// DOMAIN ENTITY (What your business logic works with)
// ============================================================================

export interface Organization {
  id: string;
  code: string;
  name: string;
  legalName: string;
  organizationType: OrganizationType;
  taxId: string | null;
  email: string;
  phone: string | null;
  website: string | null;
  logoUrl: string | null;

  // Subscription
  subscriptionTier: SubscriptionTier;
  subscriptionStatus: SubscriptionStatus;
  subscriptionStartDate: Date | null;
  subscriptionEndDate: Date | null;
  maxHotels: number;
  maxRooms: number;
  maxUsers: number;

  // Features & Settings
  enabledFeatures: JsonValue;
  settings: JsonValue;

  // Audit
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

// ============================================================================
// PRISMA EXTENSIONS (Type-safe includes)
// ============================================================================

export type OrganizationWithCounts = Prisma.OrganizationGetPayload<{
  include: {
    _count: {
      select: {
        hotels: true;
        users: true;
        reservations?: true;
      };
    };
  };
}>;

export type OrganizationWithHotels = Prisma.OrganizationGetPayload<{
  include: {
    hotels: {
      select: {
        id: true;
        name: true;
        status: true;
        totalRooms: true;
      };
    };
  };
}>;

export type OrganizationFullStats = Prisma.OrganizationGetPayload<{
  include: {
    _count: {
      select: {
        hotels: true;
        users: true;
        reservations: true;
      };
    };
    hotels: {
      select: {
        id: true;
        name: true;
        status: true;
        totalRooms: true;
      };
    };
  };
}>;

// ============================================================================
// BUSINESS TYPES (Service layer inputs/outputs)
// ============================================================================

export interface OrganizationFilters {
  search?: string;
  status?: SubscriptionStatus;
  type?: OrganizationType;
  skip?: number;
  take?: number;
}

export interface OrganizationListResult {
  data: OrganizationWithCounts[];
  total: number;
}

export interface OrganizationStats {
  id: string;
  name: string;
  code: string;
  stats: {
    totalHotels: number;
    totalUsers: number;
    totalReservations: number;
    hotels: Array<{
      id: string;
      name: string;
      status: string;
      totalRooms: number;
    }>;
  };
  subscription: {
    tier: SubscriptionTier;
    status: SubscriptionStatus;
    maxHotels: number;
    maxRooms: number;
    maxUsers: number;
    startDate: Date | null;
    endDate: Date | null;
  };
  usage: {
    hotelsUsed: number;
    hotelsRemaining: number;
    usersUsed: number;
    usersRemaining: number;
  };
}

export interface LimitValidationResult {
  valid: boolean;
  message?: string;
  current?: number;
  max?: number;
  requested?: number;
}

// ============================================================================
// SUBSCRIPTION CONFIGURATION
// ============================================================================

export interface SubscriptionLimits {
  hotels: number;
  rooms: number;
  users: number;
  features: string[];
  priceMonthly?: number;
}

export const SUBSCRIPTION_CONFIG: Record<SubscriptionTier, SubscriptionLimits> = {
  TRIAL: {
    hotels: 1,
    rooms: 20,
    users: 5,
    features: ['basic', 'trial'],
    priceMonthly: 0,
  },
  BASIC: {
    hotels: 1,
    rooms: 100,
    users: 20,
    features: ['basic', 'reports', 'email_support'],
    priceMonthly: 99,
  },
  PRO: {
    hotels: 5,
    rooms: 500,
    users: 100,
    features: ['basic', 'reports', 'api', 'channels', 'priority_support'],
    priceMonthly: 299,
  },
  ENTERPRISE: {
    hotels: 999,
    rooms: 9999,
    users: 999,
    features: ['*'], // All features
    priceMonthly: 999,
  },
} as const;

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isSubscriptionTier(tier: string): tier is SubscriptionTier {
  return ['TRIAL', 'BASIC', 'PRO', 'ENTERPRISE'].includes(tier);
}

export function isOrganizationType(type: string): type is OrganizationType {
  return ['CHAIN', 'INDEPENDENT'].includes(type);
}

export function isSubscriptionStatus(status: string): status is SubscriptionStatus {
  return ['ACTIVE', 'SUSPENDED', 'CANCELLED', 'EXPIRED'].includes(status);
}
