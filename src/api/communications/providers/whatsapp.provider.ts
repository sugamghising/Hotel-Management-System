import { logger } from '../../../core';
import { CommunicationChannel } from '../../../generated/prisma';
import type { ProviderPayload } from '../communications.types';
import type { ICommunicationProvider, ProviderConfig } from './provider.interface';

/**
 * Implements a stub WhatsApp provider for development and integration testing.
 *
 * The provider logs outbound payload metadata and returns a synthetic provider
 * ID rather than invoking live WhatsApp APIs.
 */
export class WhatsAppProvider implements ICommunicationProvider {
  readonly channel = CommunicationChannel.WHATSAPP;
  private config: ProviderConfig;

  /**
   * Creates the WhatsApp provider with optional sender and sandbox configuration.
   *
   * @param config - Provider configuration such as from-address and sandbox mode.
   */
  constructor(config: ProviderConfig = {}) {
    this.config = config;
  }

  /**
   * Simulates WhatsApp message delivery and returns a synthetic external ID.
   *
   * Side effects:
   * - Logs dispatch metadata and truncated content preview.
   * - Waits briefly to emulate external API latency.
   *
   * @param payload - Outbound WhatsApp payload.
   * @returns Generated external message identifier.
   */
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

  /**
   * Verifies webhook signatures for inbound WhatsApp status callbacks.
   *
   * Sandbox mode accepts signatures unconditionally for local testing.
   * Non-sandbox mode rejects callbacks until real signature verification is added.
   *
   * @param signature - Signature header value from provider webhook.
   * @param _body - Raw webhook body, reserved for production verification logic.
   * @returns `true` in sandbox mode; otherwise `false`.
   */
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
    logger.warn(
      '💬 [WHATSAPP STUB] Webhook signature verification not implemented; rejecting webhook in non-sandbox mode'
    );
    return false;
  }
}

export const whatsappProvider = new WhatsAppProvider({ sandbox: true });
