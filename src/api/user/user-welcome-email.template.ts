export interface UserWelcomeEmailTemplateInput {
  firstName?: string | null;
  temporaryPassword: string;
}

export interface UserWelcomeEmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export const buildUserWelcomeEmailTemplate = (
  input: UserWelcomeEmailTemplateInput
): UserWelcomeEmailTemplate => {
  const greetingName = input.firstName?.trim() || 'there';
  const subject = 'Your account has been created';
  const text = [
    `Hi ${greetingName},`,
    '',
    'Your account has been created successfully.',
    `Temporary password: ${input.temporaryPassword}`,
    '',
    'Please sign in and change this temporary password as soon as possible.',
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
      <p>Hi ${greetingName},</p>
      <p>Your account has been created successfully.</p>
      <p>
        <strong>Temporary password:</strong> ${input.temporaryPassword}
      </p>
      <p>Please sign in and change this temporary password as soon as possible.</p>
    </div>
  `.trim();

  return { subject, html, text };
};
