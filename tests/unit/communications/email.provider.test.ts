import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  brevoClientCtor: vi.fn(),
  brevoSend: vi.fn(),
}));

vi.mock('@getbrevo/brevo', () => ({
  BrevoClient: class {
    transactionalEmails = {
      sendTransacEmail: (payload: unknown): Promise<unknown> => mocks.brevoSend(payload),
    };
    constructor(config: unknown) {
      mocks.brevoClientCtor(config);
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

    mocks.brevoClientCtor.mockReset();
    mocks.brevoSend.mockReset();
  });

  it('uses Brevo when API key and from address are configured', async () => {
    process.env['NODE_ENV'] = 'development';
    mocks.brevoSend.mockResolvedValueOnce({ messageId: 'brevo_message_123' });

    const provider = new EmailProvider({
      apiKey: 'brevo_api_key',
      fromAddress: 'noreply@hotel.com',
      sandbox: false,
    });

    const externalId = await provider.send({
      to: 'guest@example.com',
      subject: 'Booking confirmation',
      content: '<p>Welcome</p>',
    });

    expect(mocks.brevoClientCtor).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'brevo_api_key' })
    );
    expect(mocks.brevoSend).toHaveBeenCalledTimes(1);
    expect(externalId).toBe('brevo_message_123');
  });

  it('falls back to stub mode in development when Brevo config is missing', async () => {
    process.env['NODE_ENV'] = 'development';

    const provider = new EmailProvider({ sandbox: true });

    const externalId = await provider.send({
      to: 'guest@example.com',
      subject: 'Hello',
      content: 'Fallback mode',
    });

    expect(externalId.startsWith('email_stub_')).toBe(true);
    expect(mocks.brevoSend).not.toHaveBeenCalled();
  });

  it('throws in production when Brevo config is missing', async () => {
    process.env['NODE_ENV'] = 'production';

    const provider = new EmailProvider({});

    await expect(
      provider.send({
        to: 'guest@example.com',
        subject: 'Should fail',
        content: 'Missing config',
      })
    ).rejects.toThrow('Brevo configuration is required in production');
  });
});
