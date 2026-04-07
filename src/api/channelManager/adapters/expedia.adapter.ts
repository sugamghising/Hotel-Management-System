import { GenericChannelAdapter } from './generic.adapter';

export class ExpediaAdapter extends GenericChannelAdapter {
  /**
   * Initializes the Expedia adapter with the canonical `'EXPEDIA'` channel code
   * required by channel routing and outbound synchronization logs.
   */
  constructor() {
    super('EXPEDIA');
  }
}

export const expediaAdapter = new ExpediaAdapter();
