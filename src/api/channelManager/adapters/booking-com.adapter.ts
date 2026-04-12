import { GenericChannelAdapter } from './generic.adapter';

export class BookingComAdapter extends GenericChannelAdapter {
  /**
   * Initializes the Booking.com adapter with the canonical `'BOOKING_COM'`
   * channel code so downstream mapping and webhook processing stay normalized.
   */
  constructor() {
    super('BOOKING_COM');
  }
}

export const bookingComAdapter = new BookingComAdapter();
