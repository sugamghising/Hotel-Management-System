import { logger } from '../../core';

export interface NotificationPayload {
  type: 'INFO' | 'WARNING' | 'ERROR';
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export class NotificationService {
  /**
   * Dispatches an in-app notification payload to a list of users.
   *
   * This implementation currently emits structured logs only; it serves as the
   * integration seam for future email/SMS/push fan-out.
   *
   * @param userIds - Recipient user IDs.
   * @param payload - Notification content and optional metadata.
   * @returns Resolves after logging the dispatch event.
   */
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
