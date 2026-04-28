import sgMail, { type MailDataRequired } from '@sendgrid/mail';
import { logger } from '../../../core';
import { CommunicationChannel } from '../../../generated/prisma';
import type { ProviderPayload } from '../communications.types';
import type { ICommunicationProvider, ProviderConfig } from './provider.interface';

/**
 * Implements email delivery with SendGrid and development/test stub fallback.
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
    if (!this.hasRequiredSendGridConfig()) {
      const runtimeEnv = process.env['NODE_ENV'] ?? 'development';
      if (runtimeEnv === 'production') {
        throw new Error(
          'SendGrid configuration is required in production. Set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL.'
        );
      }
      return this.sendStub(payload);
    }

    const apiKey = this.config.apiKey;
    const configuredFrom = this.config.fromAddress;
    if (!apiKey || !configuredFrom) {
      throw new Error('SendGrid configuration unexpectedly missing');
    }

    const fromAddress = payload.from ?? configuredFrom;
    const message: MailDataRequired = {
      to: payload.to,
      from: fromAddress,
      subject: payload.subject ?? 'Hotel communication',
      text: this.toPlainText(payload.content),
      html: payload.content,
      ...(this.config.sandbox
        ? {
            mailSettings: {
              sandboxMode: {
                enable: true,
              },
            },
          }
        : {}),
    };

    sgMail.setApiKey(apiKey);

    try {
      const [response] = await sgMail.send(message);
      const externalId = this.extractMessageId(response) ?? this.generateExternalId('email_sg');

      logger.info('📧 [SENDGRID] Email sent', {
        to: payload.to,
        subject: payload.subject,
        from: fromAddress,
        externalId,
        sandbox: this.config.sandbox ?? false,
      });

      return externalId;
    } catch (error) {
      const providerErrorMessage = this.extractErrorMessage(error);
      logger.error('📧 [SENDGRID] Failed to send email', {
        to: payload.to,
        subject: payload.subject,
        error: providerErrorMessage,
      });
      throw new Error(`SendGrid delivery failed: ${providerErrorMessage}`);
    }
  }

  private async sendStub(payload: ProviderPayload): Promise<string> {
    const externalId = this.generateExternalId('email_stub');

    logger.info('📧 [EMAIL STUB] SendGrid config missing; using stub send', {
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
      '📧 [SENDGRID] Webhook signature verification is not implemented; rejecting webhook in non-sandbox mode'
    );
    return false;
  }

  private hasRequiredSendGridConfig(): boolean {
    return Boolean(this.config.apiKey && this.config.fromAddress);
  }

  private generateExternalId(prefix: 'email_stub' | 'email_sg'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private extractMessageId(response: unknown): string | null {
    if (!response || typeof response !== 'object') {
      return null;
    }

    const responseLike = response as {
      headers?: Record<string, unknown> | { get?: (name: string) => string | null };
    };
    const { headers } = responseLike;

    if (!headers) {
      return null;
    }

    if ('get' in headers && typeof headers.get === 'function') {
      const value = headers.get('x-message-id');
      return typeof value === 'string' && value.length > 0 ? value : null;
    }

    if (typeof headers === 'object') {
      const headerRecord = headers as Record<string, unknown>;
      const candidate = headerRecord['x-message-id'] ?? headerRecord['X-Message-Id'];
      if (typeof candidate === 'string') {
        return candidate;
      }
      if (Array.isArray(candidate)) {
        const first = candidate[0];
        return typeof first === 'string' ? first : null;
      }
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
  ...(process.env['SENDGRID_API_KEY'] ? { apiKey: process.env['SENDGRID_API_KEY'] } : {}),
  ...(process.env['SENDGRID_FROM_EMAIL']
    ? { fromAddress: process.env['SENDGRID_FROM_EMAIL'] }
    : {}),
  ...(process.env['SENDGRID_WEBHOOK_SECRET']
    ? { webhookSecret: process.env['SENDGRID_WEBHOOK_SECRET'] }
    : {}),
};

export const emailProvider = new EmailProvider(emailProviderConfig);
