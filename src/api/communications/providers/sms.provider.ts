import { logger } from '../../../core';
import { CommunicationChannel } from '../../../generated/prisma';
import type { ProviderPayload } from '../communications.types';
import type { ICommunicationProvider, ProviderConfig } from './provider.interface';

/**
 * Stub SMS provider for development and testing.
 * Logs the payload and returns a mock external ID.
 * Replace with real implementation (Twilio, Nexmo, MessageBird, etc.) in production.
 */
export class SmsProvider implements ICommunicationProvider {
  readonly channel = CommunicationChannel.SMS;
  private config: ProviderConfig;

  constructor(config: ProviderConfig = {}) {
    this.config = config;
  }

  async send(payload: ProviderPayload): Promise<string> {
    const externalId = `sms_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    logger.info('📱 [SMS STUB] Sending SMS', {
      to: payload.to,
      from: payload.from ?? this.config.fromAddress ?? '+15551234567',
      contentLength: payload.content.length,
      externalId,
      sandbox: this.config.sandbox ?? true,
    });

    // Simulate async send with small delay
    await new Promise((resolve) => setTimeout(resolve, 50));

    // SMS messages are typically short, log full content
    logger.debug('📱 [SMS STUB] Message content', {
      externalId,
      content: payload.content.substring(0, 160), // SMS character limit
    });

    return externalId;
  }

  verifyWebhookSignature(signature: string, _body: string): boolean {
    // Stub: accept any signature in dev mode
    if (this.config.sandbox) {
      logger.debug('📱 [SMS STUB] Webhook signature verification (sandbox mode)', { signature });
      return true;
    }

    // In production, implement actual signature verification
    // e.g., for Twilio: verify X-Twilio-Signature header
    logger.warn('📱 [SMS STUB] Webhook signature verification not implemented');
    return true;
  }
}

export const smsProvider = new SmsProvider({ sandbox: true });
