import type { CommunicationChannel } from '../../../generated/prisma';
import type { ProviderPayload } from '../communications.types';

/**
 * Interface for communication providers.
 * Each provider implements this interface to handle sending messages via their channel.
 * Providers are stubs that can be replaced with real implementations.
 */
export interface ICommunicationProvider {
  /**
   * The communication channel this provider handles
   */
  readonly channel: CommunicationChannel;

  /**
   * Send a message via this provider
   * @param payload The message payload
   * @returns The external ID from the provider for tracking
   * @throws Error if sending fails
   */
  send(payload: ProviderPayload): Promise<string>;

  /**
   * Verify a webhook signature from this provider
   * @param signature The signature from the request header
   * @param body The raw request body
   * @returns true if signature is valid
   */
  verifyWebhookSignature?(signature: string, body: string): boolean;
}

/**
 * Provider configuration options
 */
export interface ProviderConfig {
  apiKey?: string;
  apiSecret?: string;
  fromAddress?: string;
  webhookSecret?: string;
  sandbox?: boolean;
}

/**
 * Provider registry for dependency injection
 */
export interface ProviderRegistry {
  email: ICommunicationProvider;
  sms: ICommunicationProvider;
  whatsapp: ICommunicationProvider;
  push: ICommunicationProvider;
}

/**
 * Get provider by channel type
 */
export function getProviderForChannel(
  registry: ProviderRegistry,
  channel: CommunicationChannel
): ICommunicationProvider {
  switch (channel) {
    case 'EMAIL':
      return registry.email;
    case 'SMS':
      return registry.sms;
    case 'WHATSAPP':
      return registry.whatsapp;
    case 'PUSH':
      return registry.push;
    default:
      throw new Error(`Unknown communication channel: ${channel}`);
  }
}
