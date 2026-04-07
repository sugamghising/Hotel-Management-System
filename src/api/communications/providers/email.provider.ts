import { logger } from '../../../core';
import { CommunicationChannel } from '../../../generated/prisma';
import type { ProviderPayload } from '../communications.types';
import type { ICommunicationProvider, ProviderConfig } from './provider.interface';

/**
 * Implements a stub email provider used in development and automated tests.
 *
 * The provider simulates dispatch by logging payload metadata and returning a
 * generated external ID instead of contacting real vendor APIs.
 */
export class EmailProvider implements ICommunicationProvider {
  readonly channel = CommunicationChannel.EMAIL;
  private config: ProviderConfig;

  /**
   * Creates the email provider with optional sender and sandbox configuration.
   *
   * @param config - Provider configuration such as default sender and sandbox mode.
   */
  constructor(config: ProviderConfig = {}) {
    this.config = config;
  }

  /**
   * Simulates email delivery and returns a synthetic provider message ID.
   *
   * Side effects:
   * - Writes structured info/debug logs including content preview.
   * - Introduces a short async delay to mimic provider network latency.
   *
   * @param payload - Outbound email payload.
   * @returns Generated external message ID for status correlation.
   */
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

  /**
   * Verifies inbound webhook signatures for email events.
   *
   * In sandbox mode the method accepts all signatures to simplify local testing.
   * In non-sandbox mode this stub rejects all requests and logs a warning until
   * a real signature algorithm (for example SendGrid HMAC verification) is wired.
   *
   * @param signature - Signature header value from provider webhook request.
   * @param _body - Raw webhook body, currently unused by the stub.
   * @returns `true` in sandbox mode; otherwise `false`.
   */
  verifyWebhookSignature(signature: string, _body: string): boolean {
    // Stub: accept any signature in dev mode
    if (this.config.sandbox) {
      logger.debug('📧 [EMAIL STUB] Webhook signature verification (sandbox mode)', { signature });
      return true;
    }

    // In production, implement actual signature verification
    // e.g., for SendGrid: verify HMAC-SHA256 signature
    logger.warn(
      '📧 [EMAIL STUB] Webhook signature verification not implemented; rejecting webhook in non-sandbox mode'
    );
    return false;
  }
}

export const emailProvider = new EmailProvider({ sandbox: true });
