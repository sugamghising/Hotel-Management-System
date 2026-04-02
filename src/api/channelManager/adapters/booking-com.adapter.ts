import { GenericChannelAdapter } from './generic.adapter';

export class BookingComAdapter extends GenericChannelAdapter {
  constructor() {
    super('BOOKING_COM');
  }
}

export const bookingComAdapter = new BookingComAdapter();
