import { logger } from '../../../core';
import { CommunicationChannel } from '../../../generated/prisma';
import type { ProviderPayload } from '../communications.types';
import type { ICommunicationProvider, ProviderConfig } from './provider.interface';

/**
 * Implements a stub SMS provider for local and test environments.
 *
 * The provider avoids external API calls by logging outbound payloads and
 * returning a generated tracking ID.
 */
export class SmsProvider implements ICommunicationProvider {
  readonly channel = CommunicationChannel.SMS;
  private config: ProviderConfig;

  /**
   * Creates the SMS provider with optional sender and sandbox configuration.
   *
   * @param config - Provider configuration such as default sender and sandbox mode.
   */
  constructor(config: ProviderConfig = {}) {
    this.config = config;
  }

  /**
   * Simulates SMS delivery and returns a synthetic provider message ID.
   *
   * Side effects:
   * - Writes structured logs including destination and truncated body preview.
   * - Waits briefly to imitate async provider latency.
   *
   * @param payload - Outbound SMS payload.
   * @returns Generated external message ID for later webhook correlation.
   */
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

  /**
   * Verifies webhook signatures for SMS provider callbacks.
   *
   * Sandbox mode accepts all signatures. Non-sandbox mode currently rejects
   * callbacks because this stub does not implement vendor-specific signature checks.
   *
   * @param signature - Signature header from the webhook request.
   * @param _body - Raw webhook body, reserved for real signature checks.
   * @returns `true` in sandbox mode; otherwise `false`.
   */
  verifyWebhookSignature(signature: string, _body: string): boolean {
    // Stub: accept any signature in dev mode
    if (this.config.sandbox) {
      logger.debug('📱 [SMS STUB] Webhook signature verification (sandbox mode)', { signature });
      return true;
    }

    // In production, implement actual signature verification
    // e.g., for Twilio: verify X-Twilio-Signature header
    logger.warn(
      '📱 [SMS STUB] Webhook signature verification not implemented; rejecting webhook in non-sandbox mode'
    );
    return false;
  }
}

export const smsProvider = new SmsProvider({ sandbox: true });
