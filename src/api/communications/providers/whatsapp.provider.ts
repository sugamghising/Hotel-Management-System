import { logger } from '../../../core';
import { CommunicationChannel } from '../../../generated/prisma';
import type { ProviderPayload } from '../communications.types';
import type { ICommunicationProvider, ProviderConfig } from './provider.interface';

/**
 * Stub WhatsApp provider for development and testing.
 * Logs the payload and returns a mock external ID.
 * Replace with real implementation (WhatsApp Business API, Twilio WhatsApp, etc.) in production.
 */
export class WhatsAppProvider implements ICommunicationProvider {
  readonly channel = CommunicationChannel.WHATSAPP;
  private config: ProviderConfig;

  constructor(config: ProviderConfig = {}) {
    this.config = config;
  }

  async send(payload: ProviderPayload): Promise<string> {
    const externalId = `wa_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    logger.info('💬 [WHATSAPP STUB] Sending WhatsApp message', {
      to: payload.to,
      from: payload.from ?? this.config.fromAddress ?? '+15551234567',
      contentLength: payload.content.length,
      externalId,
      sandbox: this.config.sandbox ?? true,
    });

    // Simulate async send with small delay
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Log content preview
    logger.debug('💬 [WHATSAPP STUB] Message content', {
      externalId,
      preview: payload.content.substring(0, 300),
    });

    return externalId;
  }

  verifyWebhookSignature(signature: string, _body: string): boolean {
    // Stub: accept any signature in dev mode
    if (this.config.sandbox) {
      logger.debug('💬 [WHATSAPP STUB] Webhook signature verification (sandbox mode)', {
        signature,
      });
      return true;
    }

    // In production, implement actual signature verification
    // e.g., for WhatsApp Business API: verify X-Hub-Signature header
    logger.warn('💬 [WHATSAPP STUB] Webhook signature verification not implemented; rejecting webhook in non-sandbox mode');
    return false;
  }
}

export const whatsappProvider = new WhatsAppProvider({ sandbox: true });
