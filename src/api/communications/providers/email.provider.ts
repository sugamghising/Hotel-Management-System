import { Resend } from 'resend';
import { logger } from '../../../core';
import { CommunicationChannel } from '../../../generated/prisma';
import type { ProviderPayload } from '../communications.types';
import type { ICommunicationProvider, ProviderConfig } from './provider.interface';

/**
 * Implements email delivery with Resend and development/test stub fallback.
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
    if (!this.hasRequiredResendConfig()) {
      const runtimeEnv = process.env['NODE_ENV'] ?? 'development';
      if (runtimeEnv === 'production') {
        throw new Error(
          'Resend configuration is required in production. Set RESEND_API_KEY and RESEND_FROM_EMAIL.'
        );
      }
      return this.sendStub(payload);
    }

    const apiKey = this.config.apiKey;
    const configuredFrom = this.config.fromAddress;
    if (!apiKey || !configuredFrom) {
      throw new Error('Resend configuration unexpectedly missing');
    }

    const fromAddress = payload.from ?? configuredFrom;
    const resend = new Resend(apiKey);

    try {
      const response = await resend.emails.send({
        from: fromAddress,
        to: payload.to,
        subject: payload.subject ?? 'Hotel communication',
        html: payload.content,
        text: this.resolveTextContent(payload),
      });
      const resendError = this.extractResendError(response);
      if (resendError) {
        throw new Error(resendError);
      }

      const externalId = this.extractMessageId(response) ?? this.generateExternalId('email_resend');

      logger.info('📧 [RESEND] Email sent', {
        to: payload.to,
        subject: payload.subject,
        from: fromAddress,
        externalId,
        sandbox: this.config.sandbox ?? false,
      });

      return externalId;
    } catch (error) {
      const providerErrorMessage = this.extractErrorMessage(error);
      logger.error('📧 [RESEND] Failed to send email', {
        to: payload.to,
        subject: payload.subject,
        error: providerErrorMessage,
      });
      throw new Error(`Resend delivery failed: ${providerErrorMessage}`);
    }
  }

  private async sendStub(payload: ProviderPayload): Promise<string> {
    const externalId = this.generateExternalId('email_stub');

    logger.info('📧 [EMAIL STUB] Resend config missing; using stub send', {
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
      '📧 [RESEND] Webhook signature verification is not implemented; rejecting webhook in non-sandbox mode'
    );
    return false;
  }

  private hasRequiredResendConfig(): boolean {
    return Boolean(this.config.apiKey && this.config.fromAddress);
  }

  private generateExternalId(prefix: 'email_stub' | 'email_resend'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private extractMessageId(response: unknown): string | null {
    if (!response || typeof response !== 'object') {
      return null;
    }

    const responseLike = response as {
      id?: unknown;
      messageId?: unknown;
      data?: {
        id?: unknown;
        messageId?: unknown;
      };
      body?: {
        id?: unknown;
        messageId?: unknown;
      };
    };

    if (typeof responseLike.id === 'string' && responseLike.id.length > 0) {
      return responseLike.id;
    }

    if (typeof responseLike.messageId === 'string' && responseLike.messageId.length > 0) {
      return responseLike.messageId;
    }

    if (typeof responseLike.data?.id === 'string' && responseLike.data.id.length > 0) {
      return responseLike.data.id;
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

  private extractResendError(response: unknown): string | null {
    if (!response || typeof response !== 'object') {
      return null;
    }

    const responseLike = response as {
      error?: unknown;
    };
    const error = responseLike.error;

    if (!error) {
      return null;
    }

    if (typeof error === 'string') {
      return error;
    }

    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'object') {
      const errorLike = error as { message?: unknown; name?: unknown };
      if (typeof errorLike.message === 'string' && errorLike.message.length > 0) {
        return errorLike.message;
      }
      if (typeof errorLike.name === 'string' && errorLike.name.length > 0) {
        return errorLike.name;
      }
    }

    return 'Unknown provider error';
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

  private resolveTextContent(payload: ProviderPayload): string {
    const metadataText = payload.metadata?.['text'];
    if (typeof metadataText === 'string' && metadataText.trim().length > 0) {
      return metadataText;
    }
    return this.toPlainText(payload.content);
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
  ...(process.env['RESEND_API_KEY'] ? { apiKey: process.env['RESEND_API_KEY'] } : {}),
  ...(process.env['RESEND_FROM_EMAIL'] ? { fromAddress: process.env['RESEND_FROM_EMAIL'] } : {}),
  ...(process.env['RESEND_WEBHOOK_SECRET']
    ? { webhookSecret: process.env['RESEND_WEBHOOK_SECRET'] }
    : {}),
};

export const emailProvider = new EmailProvider(emailProviderConfig);
