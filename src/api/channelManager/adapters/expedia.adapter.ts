import { GenericChannelAdapter } from './generic.adapter';

export class ExpediaAdapter extends GenericChannelAdapter {
  constructor() {
    super('EXPEDIA');
  }
}

export const expediaAdapter = new ExpediaAdapter();
