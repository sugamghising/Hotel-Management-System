import type { OrganizationResponse } from './organization.schema';

export {
  // Schemas
  OrganizationCreateSchema,
  OrganizationCreateSchemaWithDefaults,
  OrganizationUpdateSchema,
  OrganizationQuerySchema,
  OrganizationIdParamSchema,
  SubscriptionUpdateSchema,
  OrganizationResponseSchema,
  // Types
  type OrganizationCreateInput,
  type OrganizationCreateWithDefaults,
  type OrganizationUpdateInput,
  type OrganizationQueryInput,
  type SubscriptionUpdateInput,
  type OrganizationResponse,
} from './organization.schema';

// API-specific DTOs not covered by schemas
export interface OrganizationListResponse {
  organizations: OrganizationResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface OrganizationLimitsResponse {
  resource: 'hotel' | 'user' | 'room';
  current: number;
  max: number;
  remaining: number;
  canCreate: boolean;
}
