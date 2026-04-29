import { BrevoClient } from '@getbrevo/brevo';
import { logger } from '../../../core';
import { CommunicationChannel } from '../../../generated/prisma';
import type { ProviderPayload } from '../communications.types';
import type { ICommunicationProvider, ProviderConfig } from './provider.interface';

/**
 * Implements email delivery with Brevo and development/test stub fallback.
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

  async send(payload: ProviderPayload): Promise<string> {
    if (!this.hasRequiredBrevoConfig()) {
      const runtimeEnv = process.env['NODE_ENV'] ?? 'development';
      if (runtimeEnv === 'production') {
        throw new Error(
          'Brevo configuration is required in production. Set BREVO_API_KEY and BREVO_FROM_EMAIL.'
        );
      }
      return this.sendStub(payload);
    }

    const apiKey = this.config.apiKey;
    const configuredFrom = this.config.fromAddress;
    if (!apiKey || !configuredFrom) {
      throw new Error('Brevo configuration unexpectedly missing');
    }

    const fromAddress = payload.from ?? configuredFrom;
    const brevo = new BrevoClient({ apiKey });

    try {
      const response = await brevo.transactionalEmails.sendTransacEmail({
        sender: {
          email: fromAddress,
        },
        to: [
          {
            email: payload.to,
          },
        ],
        subject: payload.subject ?? 'Hotel communication',
        htmlContent: payload.content,
        textContent: this.toPlainText(payload.content),
      });
      const externalId = this.extractMessageId(response) ?? this.generateExternalId('email_brevo');

      logger.info('📧 [BREVO] Email sent', {
        to: payload.to,
        subject: payload.subject,
        from: fromAddress,
        externalId,
        sandbox: this.config.sandbox ?? false,
      });

      return externalId;
    } catch (error) {
      const providerErrorMessage = this.extractErrorMessage(error);
      logger.error('📧 [BREVO] Failed to send email', {
        to: payload.to,
        subject: payload.subject,
        error: providerErrorMessage,
      });
      throw new Error(`Brevo delivery failed: ${providerErrorMessage}`);
    }
  }

  private async sendStub(payload: ProviderPayload): Promise<string> {
    const externalId = this.generateExternalId('email_stub');

    logger.info('📧 [EMAIL STUB] Brevo config missing; using stub send', {
      to: payload.to,
      subject: payload.subject,
      from: payload.from ?? this.config.fromAddress ?? 'noreply@hotel.com',
      contentLength: payload.content.length,
      externalId,
      sandbox: this.config.sandbox ?? true,
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    logger.debug('📧 [EMAIL STUB] Content preview', {
      externalId,
      preview: payload.content.substring(0, 200),
    });

    return externalId;
  }

  verifyWebhookSignature(signature: string, _body: string): boolean {
    if (this.config.sandbox) {
      logger.debug('📧 [EMAIL STUB] Webhook signature verification (sandbox mode)', {
        signature,
      });
      return true;
    }

    logger.warn(
      '📧 [BREVO] Webhook signature verification is not implemented; rejecting webhook in non-sandbox mode'
    );
    return false;
  }

  private hasRequiredBrevoConfig(): boolean {
    return Boolean(this.config.apiKey && this.config.fromAddress);
  }

  private generateExternalId(prefix: 'email_stub' | 'email_brevo'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private extractMessageId(response: unknown): string | null {
    if (!response || typeof response !== 'object') {
      return null;
    }

    const responseLike = response as {
      messageId?: unknown;
      data?: {
        messageId?: unknown;
      };
      body?: {
        messageId?: unknown;
      };
    };

    if (typeof responseLike.messageId === 'string' && responseLike.messageId.length > 0) {
      return responseLike.messageId;
    }

    if (
      typeof responseLike.data?.messageId === 'string' &&
      responseLike.data.messageId.length > 0
    ) {
      return responseLike.data.messageId;
    }

    if (
      typeof responseLike.body?.messageId === 'string' &&
      responseLike.body.messageId.length > 0
    ) {
      return responseLike.body.messageId;
    }

    return null;
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    return 'Unknown provider error';
  }

  private toPlainText(content: string): string {
    return content
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

const runtimeEnv = process.env['NODE_ENV'] ?? 'development';

const emailProviderConfig: ProviderConfig = {
  sandbox: runtimeEnv !== 'production',
  ...(process.env['BREVO_API_KEY'] ? { apiKey: process.env['BREVO_API_KEY'] } : {}),
  ...(process.env['BREVO_FROM_EMAIL'] ? { fromAddress: process.env['BREVO_FROM_EMAIL'] } : {}),
  ...(process.env['BREVO_WEBHOOK_SECRET']
    ? { webhookSecret: process.env['BREVO_WEBHOOK_SECRET'] }
    : {}),
};

export const emailProvider = new EmailProvider(emailProviderConfig);
