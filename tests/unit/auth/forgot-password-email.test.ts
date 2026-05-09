import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthRepository } from '../../../src/api/auth/auth.repository';
import { AuthService } from '../../../src/api/auth/auth.service';
import type { User } from '../../../src/api/auth/auth.types';
import type { OrganizationService } from '../../../src/api/organizations';

const mocks = vi.hoisted(() => ({
  generateRandomToken: vi.fn(),
  hashToken: vi.fn(),
  emailSend: vi.fn(),
}));

vi.mock('../../../src/core/utils/crypto', () => ({
  generateRandomToken: mocks.generateRandomToken,
  hashToken: mocks.hashToken,
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock('../../../src/api/communications/providers/email.provider', () => ({
  emailProvider: {
    send: mocks.emailSend,
  },
}));

describe('AuthService forgotPassword email flow', () => {
  let authRepo: Pick<AuthRepository, 'findUserByEmail' | 'setPasswordResetToken'>;
  let orgService: Pick<OrganizationService, 'findByCode'>;

  beforeEach(() => {
    mocks.generateRandomToken.mockReturnValue('raw-reset-token');
    mocks.hashToken.mockReturnValue('hashed-reset-token');
    mocks.emailSend.mockResolvedValue('email_external_id');

    authRepo = {
      findUserByEmail: vi.fn(),
      setPasswordResetToken: vi.fn(),
    };

    orgService = {
      findByCode: vi.fn(),
    };
  });

  afterEach(() => {
    mocks.generateRandomToken.mockReset();
    mocks.hashToken.mockReset();
    mocks.emailSend.mockReset();
  });

  it('sends password reset email after storing token for existing user', async () => {
    const user = {
      id: '00000000-0000-0000-0000-000000000010',
      organizationId: '00000000-0000-0000-0000-000000000001',
      email: 'user@example.com',
      firstName: 'John',
    } as User;

    vi.mocked(orgService.findByCode).mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000001',
      code: 'ORG001',
    } as Awaited<ReturnType<OrganizationService['findByCode']>>);
    vi.mocked(authRepo.findUserByEmail).mockResolvedValue(user);

    const service = new AuthService(
      authRepo as unknown as AuthRepository,
      orgService as unknown as OrganizationService
    );

    await service.forgotPassword('user@example.com', 'ORG001');

    expect(authRepo.setPasswordResetToken).toHaveBeenCalledTimes(1);
    expect(authRepo.setPasswordResetToken).toHaveBeenCalledWith(
      user.id,
      'hashed-reset-token',
      expect.any(Date)
    );
    expect(mocks.emailSend).toHaveBeenCalledTimes(1);
    expect(mocks.emailSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: user.email,
        metadata: expect.objectContaining({
          text: expect.any(String),
        }),
      })
    );
  });

  it('does not store token or send email when organization is not found', async () => {
    vi.mocked(orgService.findByCode).mockResolvedValue(null);

    const service = new AuthService(
      authRepo as unknown as AuthRepository,
      orgService as unknown as OrganizationService
    );

    await service.forgotPassword('user@example.com', 'MISSING_ORG');

    expect(authRepo.findUserByEmail).not.toHaveBeenCalled();
    expect(authRepo.setPasswordResetToken).not.toHaveBeenCalled();
    expect(mocks.emailSend).not.toHaveBeenCalled();
  });

  it('does not store token or send email when user is not found', async () => {
    vi.mocked(orgService.findByCode).mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000001',
      code: 'ORG001',
    } as Awaited<ReturnType<OrganizationService['findByCode']>>);
    vi.mocked(authRepo.findUserByEmail).mockResolvedValue(null);

    const service = new AuthService(
      authRepo as unknown as AuthRepository,
      orgService as unknown as OrganizationService
    );

    await service.forgotPassword('missing@example.com', 'ORG001');

    expect(authRepo.setPasswordResetToken).not.toHaveBeenCalled();
    expect(mocks.emailSend).not.toHaveBeenCalled();
  });

  it('does not throw when email provider fails for an existing user', async () => {
    const user = {
      id: '00000000-0000-0000-0000-000000000020',
      organizationId: '00000000-0000-0000-0000-000000000001',
      email: 'user@example.com',
      firstName: 'Jane',
    } as User;

    vi.mocked(orgService.findByCode).mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000001',
      code: 'ORG001',
    } as Awaited<ReturnType<OrganizationService['findByCode']>>);
    vi.mocked(authRepo.findUserByEmail).mockResolvedValue(user);
    mocks.emailSend.mockRejectedValueOnce(
      new Error('Resend delivery failed: Status code: 403 permission_denied')
    );

    const service = new AuthService(
      authRepo as unknown as AuthRepository,
      orgService as unknown as OrganizationService
    );

    await expect(service.forgotPassword('user@example.com', 'ORG001')).resolves.toBeUndefined();
    expect(authRepo.setPasswordResetToken).toHaveBeenCalledTimes(1);
    expect(mocks.emailSend).toHaveBeenCalledTimes(1);
  });
});
