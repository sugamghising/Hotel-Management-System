import { describe, expect, it } from 'vitest';
import { buildPasswordResetEmailTemplate } from '../../../src/api/auth/password-reset-email.template';

describe('buildPasswordResetEmailTemplate', () => {
  it('builds subject and content with reset link and expiry', () => {
    const template = buildPasswordResetEmailTemplate({
      firstName: 'John',
      resetLink: 'https://app.example.com/reset-password?token=abc123',
      expiresInMinutes: 60,
    });

    expect(template.subject).toContain('Reset your password');
    expect(template.html).toContain('https://app.example.com/reset-password?token=abc123');
    expect(template.html).toContain('60');
    expect(template.text).toContain('https://app.example.com/reset-password?token=abc123');
  });
});
