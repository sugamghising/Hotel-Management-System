// Controller & Service
export { GuestsController, guestsController } from './guests.controller';
export { GuestsService, guestsService } from './guests.service';
export { GuestsRepository, guestsRepository } from './guests.repository';
export { default as guestsRoutes } from './guests.routes';

// Types
export type {
  Guest,
  GuestType,
  VIPStatus,
  CreateGuestInput,
  UpdateGuestInput,
  GuestResponse,
  GuestListResponse,
  GuestStayHistory,
  GuestDuplicate,
  DuplicateDetectionInput,
  GuestQueryFilters,
  MergeGuestsInput,
  IDDocument,
} from './guests.types';

// Schemas & DTOs
export {
  CreateGuestSchema,
  UpdateGuestSchema,
  GuestQuerySchema,
  DuplicateDetectionSchema,
  MergeGuestsSchema,
  UpdateVIPSchema,
  GuestIdParamSchema,
  OrganizationIdParamSchema,
  GuestTypeSchema,
  VIPStatusSchema,
  IDTypeSchema,
  CountryCodeSchema,
  LanguageCodeSchema,
  // Types
  type CreateGuestInput as CreateGuestInputType,
  type UpdateGuestInput as UpdateGuestInputType,
  type GuestQueryInput,
  type DuplicateDetectionInput as DuplicateDetectionInputType,
  type MergeGuestsInput as MergeGuestsInputType,
  type UpdateVIPInput as UpdateVIPInputType,
} from './guests.schema';

export type {
  GuestSearchResult,
  GuestCommunicationHistory,
} from './guests.dto';
