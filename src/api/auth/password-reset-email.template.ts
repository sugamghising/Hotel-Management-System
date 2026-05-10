export interface PasswordResetEmailTemplateInput {
  firstName?: string | null;
  resetLink: string;
  expiresInMinutes: number;
}

export interface PasswordResetEmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export const buildPasswordResetEmailTemplate = (
  input: PasswordResetEmailTemplateInput
): PasswordResetEmailTemplate => {
  const greetingName = input.firstName?.trim() || 'there';
  const subject = 'Reset your password';
  const text = [
    `Hi ${greetingName},`,
    '',
    'We received a request to reset your password.',
    `Use this link to continue: ${input.resetLink}`,
    '',
    `This link expires in ${input.expiresInMinutes} minutes.`,
    'If you did not request this, you can safely ignore this email.',
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
      <p>Hi ${greetingName},</p>
      <p>We received a request to reset your password.</p>
      <p>
        <a href="${input.resetLink}" style="color: #2563eb; text-decoration: underline;">
          Reset Password
        </a>
      </p>
      <p>This link expires in ${input.expiresInMinutes} minutes.</p>
      <p>If you did not request this, you can safely ignore this email.</p>
    </div>
  `.trim();

  return { subject, html, text };
};
