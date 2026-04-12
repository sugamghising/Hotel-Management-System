import { logger } from '../../../core';
import { CommunicationChannel } from '../../../generated/prisma';
import type { ProviderPayload } from '../communications.types';
import type { ICommunicationProvider, ProviderConfig } from './provider.interface';

/**
 * Implements a stub push-notification provider for local environments.
 *
 * Instead of calling FCM/APNs, the provider records outbound payload data in logs
 * and returns a generated external identifier.
 */
export class PushProvider implements ICommunicationProvider {
  readonly channel = CommunicationChannel.PUSH;
  private config: ProviderConfig;

  /**
   * Creates the push provider with optional sandbox configuration.
   *
   * @param config - Provider configuration flags.
   */
  constructor(config: ProviderConfig = {}) {
    this.config = config;
  }

  /**
   * Simulates push notification delivery and returns a synthetic external ID.
   *
   * Side effects:
   * - Logs metadata and content preview for debugging.
   * - Introduces a short delay to mimic network dispatch.
   *
   * @param payload - Outbound push payload (recipient token/user + message body).
   * @returns Generated external message ID.
   */
  async send(payload: ProviderPayload): Promise<string> {
    const externalId = `push_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // For push, 'to' is typically a device token or user ID
    logger.info('🔔 [PUSH STUB] Sending push notification', {
      to: payload.to, // Device token or user ID
      title: payload.subject ?? 'Notification',
      contentLength: payload.content.length,
      externalId,
      sandbox: this.config.sandbox ?? true,
    });

    // Simulate async send with small delay
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Log notification content
    logger.debug('🔔 [PUSH STUB] Notification content', {
      externalId,
      title: payload.subject,
      body: payload.content.substring(0, 200),
      metadata: payload.metadata,
    });

    return externalId;
  }

  // Push notifications typically don't have incoming webhooks
  // Status updates come from the push service's dashboard or API
}

export const pushProvider = new PushProvider({ sandbox: true });
