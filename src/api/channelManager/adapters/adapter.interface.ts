import type { Request } from 'express';
import type { Prisma } from '../../../generated/prisma';
import type {
  AvailabilityPayload,
  ChannelCancellation,
  ChannelModification,
  ChannelReservation,
  RatesPayload,
} from '../channel.types';

export type ChannelConnectionRecord = Prisma.ChannelConnectionGetPayload<Record<string, never>>;

export interface IChannelAdapter {
  channelCode: string;

  pushAvailability(
    connection: ChannelConnectionRecord,
    payload: AvailabilityPayload
  ): Promise<void>;
  pushRates(connection: ChannelConnectionRecord, payload: RatesPayload): Promise<void>;

  pullReservations(connection: ChannelConnectionRecord): Promise<ChannelReservation[]>;

  parseWebhookReservation(body: unknown): ChannelReservation;
  parseWebhookModification(body: unknown): ChannelModification;
  parseWebhookCancellation(body: unknown): ChannelCancellation;

  verifyWebhookSignature(req: Request): boolean;
}

export type ChannelAdapterRegistry = Record<string, IChannelAdapter>;
