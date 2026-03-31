export * from './provider.interface';
export { EmailProvider, emailProvider } from './email.provider';
export { SmsProvider, smsProvider } from './sms.provider';
export { WhatsAppProvider, whatsappProvider } from './whatsapp.provider';
export { PushProvider, pushProvider } from './push.provider';

import { emailProvider } from './email.provider';
import type { ProviderRegistry } from './provider.interface';
import { pushProvider } from './push.provider';
import { smsProvider } from './sms.provider';
import { whatsappProvider } from './whatsapp.provider';

/**
 * Default provider registry with stub implementations.
 * Replace individual providers with real implementations as needed.
 */
export const defaultProviderRegistry: ProviderRegistry = {
  email: emailProvider,
  sms: smsProvider,
  whatsapp: whatsappProvider,
  push: pushProvider,
};
