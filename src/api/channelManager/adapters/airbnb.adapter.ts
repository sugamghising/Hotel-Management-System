import { GenericChannelAdapter } from './generic.adapter';

export class AirbnbAdapter extends GenericChannelAdapter {
  /**
   * Initializes the Airbnb adapter with the canonical `'AIRBNB'` channel code used
   * for adapter resolution, webhook parsing metadata, and outbound sync tagging.
   */
  constructor() {
    super('AIRBNB');
  }
}

export const airbnbAdapter = new AirbnbAdapter();
