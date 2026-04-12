import type { CommunicationChannel } from '../../../generated/prisma';
import type { ProviderPayload } from '../communications.types';

/**
 * Defines the contract that channel providers must implement for outbound messaging.
 */
export interface ICommunicationProvider {
  /**
   * Channel handled by this provider implementation.
   */
  readonly channel: CommunicationChannel;

  /**
   * Sends a normalized payload through the underlying provider API.
   *
   * @param payload - Provider-ready message content and recipient metadata.
   * @returns Provider-issued external ID used for status webhook correlation.
   */
  send(payload: ProviderPayload): Promise<string>;

  /**
   * Verifies webhook signatures using provider-specific signing rules.
   *
   * @param signature - Signature header value from the provider request.
   * @param body - Raw webhook body string used in signature computation.
   * @returns `true` when the signature is valid.
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
 * Returns the provider implementation registered for a communication channel.
 *
 * @param registry - Provider registry injected into the communications service.
 * @param channel - Requested communication channel.
 * @returns Channel-specific provider implementation.
 * @throws {Error} When an unsupported channel is requested.
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
