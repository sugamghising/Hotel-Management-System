import { logger } from '../../core';

export interface NotificationPayload {
  type: 'INFO' | 'WARNING' | 'ERROR';
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export class NotificationService {
  async send(userIds: string[], payload: NotificationPayload): Promise<void> {
    // Integration hook for external channels (email/sms/push) can be added here.
    logger.info('Notification dispatched', {
      userIds,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      metadata: payload.metadata ?? null,
    });
  }
}

export const notificationService = new NotificationService();
