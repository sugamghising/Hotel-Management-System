import { logger } from '../../../core';
import { CommunicationChannel } from '../../../generated/prisma';
import type { ProviderPayload } from '../communications.types';
import type { ICommunicationProvider, ProviderConfig } from './provider.interface';

/**
 * Stub email provider for development and testing.
 * Logs the payload and returns a mock external ID.
 * Replace with real implementation (SendGrid, SES, Mailgun, etc.) in production.
 */
export class EmailProvider implements ICommunicationProvider {
  readonly channel = CommunicationChannel.EMAIL;
  private config: ProviderConfig;

  constructor(config: ProviderConfig = {}) {
    this.config = config;
  }

  async send(payload: ProviderPayload): Promise<string> {
    const externalId = `email_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    logger.info('📧 [EMAIL STUB] Sending email', {
      to: payload.to,
      subject: payload.subject,
      from: payload.from ?? this.config.fromAddress ?? 'noreply@hotel.com',
      contentLength: payload.content.length,
      externalId,
      sandbox: this.config.sandbox ?? true,
    });

    // Simulate async send with small delay
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Log truncated content for debugging
    logger.debug('📧 [EMAIL STUB] Content preview', {
      externalId,
      preview: payload.content.substring(0, 200),
    });

    return externalId;
  }

  verifyWebhookSignature(signature: string, _body: string): boolean {
    // Stub: accept any signature in dev mode
    if (this.config.sandbox) {
      logger.debug('📧 [EMAIL STUB] Webhook signature verification (sandbox mode)', { signature });
      return true;
    }

    // In production, implement actual signature verification
    // e.g., for SendGrid: verify HMAC-SHA256 signature
    logger.warn('📧 [EMAIL STUB] Webhook signature verification not implemented');
    return true;
  }
}

export const emailProvider = new EmailProvider({ sandbox: true });
