import { GenericChannelAdapter } from './generic.adapter';

export class AirbnbAdapter extends GenericChannelAdapter {
  constructor() {
    super('AIRBNB');
  }
}

export const airbnbAdapter = new AirbnbAdapter();
