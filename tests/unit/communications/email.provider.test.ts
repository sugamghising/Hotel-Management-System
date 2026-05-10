import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resendCtor: vi.fn(),
  resendSend: vi.fn(),
}));

vi.mock('resend', () => ({
  Resend: class {
    emails = {
      send: (payload: unknown): Promise<unknown> => mocks.resendSend(payload),
    };
    constructor(apiKey: unknown) {
      mocks.resendCtor(apiKey);
    }
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

    mocks.resendCtor.mockReset();
    mocks.resendSend.mockReset();
  });

  it('uses Resend when API key and from address are configured', async () => {
    process.env['NODE_ENV'] = 'development';
    mocks.resendSend.mockResolvedValueOnce({ data: { id: 'resend_message_123' }, error: null });

    const provider = new EmailProvider({
      apiKey: 'resend_api_key',
      fromAddress: 'noreply@hotel.com',
      sandbox: false,
    });

    const externalId = await provider.send({
      to: 'guest@example.com',
      subject: 'Booking confirmation',
      content: '<p>Welcome</p>',
    });

    expect(mocks.resendCtor).toHaveBeenCalledWith('resend_api_key');
    expect(mocks.resendSend).toHaveBeenCalledTimes(1);
    expect(externalId).toBe('resend_message_123');
  });

  it('prefers metadata text content when provided', async () => {
    process.env['NODE_ENV'] = 'development';
    mocks.resendSend.mockResolvedValueOnce({ data: { id: 'resend_message_456' }, error: null });

    const provider = new EmailProvider({
      apiKey: 'resend_api_key',
      fromAddress: 'noreply@hotel.com',
      sandbox: false,
    });

    await provider.send({
      to: 'guest@example.com',
      subject: 'Reset password',
      content: '<p>HTML body</p>',
      metadata: {
        text: 'Plain text body',
      },
    });

    expect(mocks.resendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'noreply@hotel.com',
        to: 'guest@example.com',
        subject: 'Reset password',
        html: '<p>HTML body</p>',
        text: 'Plain text body',
      })
    );
  });

  it('falls back to stub mode in development when Resend config is missing', async () => {
    process.env['NODE_ENV'] = 'development';

    const provider = new EmailProvider({ sandbox: true });

    const externalId = await provider.send({
      to: 'guest@example.com',
      subject: 'Hello',
      content: 'Fallback mode',
    });

    expect(externalId.startsWith('email_stub_')).toBe(true);
    expect(mocks.resendSend).not.toHaveBeenCalled();
  });

  it('throws in production when Resend config is missing', async () => {
    process.env['NODE_ENV'] = 'production';

    const provider = new EmailProvider({});

    await expect(
      provider.send({
        to: 'guest@example.com',
        subject: 'Should fail',
        content: 'Missing config',
      })
    ).rejects.toThrow('Resend configuration is required in production');
  });
});
