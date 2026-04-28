import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  setApiKey: vi.fn(),
  send: vi.fn(),
}));

vi.mock('@sendgrid/mail', () => ({
  default: {
    setApiKey: mocks.setApiKey,
    send: mocks.send,
  },
}));

import { EmailProvider } from '../../../src/api/communications/providers/email.provider';

describe('EmailProvider', () => {
  const originalNodeEnv = process.env['NODE_ENV'];

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      process.env['NODE_ENV'] = undefined;
    } else {
      process.env['NODE_ENV'] = originalNodeEnv;
    }

    mocks.setApiKey.mockReset();
    mocks.send.mockReset();
  });

  it('uses SendGrid when API key and from address are configured', async () => {
    process.env['NODE_ENV'] = 'development';
    mocks.send.mockResolvedValueOnce([{ headers: { 'x-message-id': 'sg_message_123' } }, {}]);

    const provider = new EmailProvider({
      apiKey: 'SG.xxxxxx',
      fromAddress: 'noreply@hotel.com',
      sandbox: false,
    });

    const externalId = await provider.send({
      to: 'guest@example.com',
      subject: 'Booking confirmation',
      content: '<p>Welcome</p>',
    });

    expect(mocks.setApiKey).toHaveBeenCalledWith('SG.xxxxxx');
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(externalId).toBe('sg_message_123');
  });

  it('falls back to stub mode in development when SendGrid config is missing', async () => {
    process.env['NODE_ENV'] = 'development';

    const provider = new EmailProvider({ sandbox: true });

    const externalId = await provider.send({
      to: 'guest@example.com',
      subject: 'Hello',
      content: 'Fallback mode',
    });

    expect(externalId.startsWith('email_stub_')).toBe(true);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('throws in production when SendGrid config is missing', async () => {
    process.env['NODE_ENV'] = 'production';

    const provider = new EmailProvider({});

    await expect(
      provider.send({
        to: 'guest@example.com',
        subject: 'Should fail',
        content: 'Missing config',
      })
    ).rejects.toThrow('SendGrid configuration is required in production');
  });
});
