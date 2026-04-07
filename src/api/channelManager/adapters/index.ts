export * from './adapter.interface';
export { GenericChannelAdapter } from './generic.adapter';
export { BookingComAdapter, bookingComAdapter } from './booking-com.adapter';
export { ExpediaAdapter, expediaAdapter } from './expedia.adapter';
export { AirbnbAdapter, airbnbAdapter } from './airbnb.adapter';

import type { IChannelAdapter } from './adapter.interface';
import { airbnbAdapter } from './airbnb.adapter';
import { bookingComAdapter } from './booking-com.adapter';
import { expediaAdapter } from './expedia.adapter';
import { GenericChannelAdapter } from './generic.adapter';

const genericAdapter = new GenericChannelAdapter('GENERIC');

export const channelAdapters: Record<string, IChannelAdapter> = {
  BOOKING_COM: bookingComAdapter,
  EXPEDIA: expediaAdapter,
  AIRBNB: airbnbAdapter,
};

/**
 * Resolves a channel adapter from a raw channel code and falls back to the
 * generic adapter when no dedicated integration is registered.
 *
 * @param channelCode - Raw channel code from API input or webhook payload.
 * @returns The specialized adapter for the normalized code, or the generic stub.
 */
export const getAdapterByChannelCode = (channelCode: string): IChannelAdapter => {
  const normalized = channelCode.trim().toUpperCase();
  return channelAdapters[normalized] ?? genericAdapter;
};
