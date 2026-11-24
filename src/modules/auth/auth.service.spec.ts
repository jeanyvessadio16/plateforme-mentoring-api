import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../../core/database/prisma.service.js';
import { SupabaseService } from '../../core/supabase/supabase.service.js';
import { AccountStatus, UserRole } from '../../generated/prisma/client.js';

describe('AuthService', () => {
  let service: AuthService;

  const mockAdminSignOut = vi.fn().mockResolvedValue({ error: null });
  const mockAdminCreateUser = vi.fn();
  const mockAdminDeleteUser = vi.fn().mockResolvedValue({ error: null });
  const mockAdminUpdateUser = vi.fn();
  const mockSignUp = vi.fn();
  const mockSignInWithPassword = vi.fn();
  const mockVerifyOtp = vi.fn();

  const mockPrisma = {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };

  const mockSupabase = {
    getClient: vi.fn().mockReturnValue({
      auth: {
        signInWithPassword: mockSignInWithPassword,
        refreshSession: vi.fn(),
        signOut: vi.fn(),
        resetPasswordForEmail: vi.fn(),
        verifyOtp: mockVerifyOtp,
        signUp: mockSignUp,
      },
    }),
    getAdminClient: vi.fn().mockReturnValue({
      auth: {
        admin: {
          createUser: mockAdminCreateUser,
          updateUserById: mockAdminUpdateUser,
          deleteUser: mockAdminDeleteUser,
          signOut: mockAdminSignOut,
        },
      },
    }),
  };

  const mockConfigService = {
    get: vi.fn().mockReturnValue('false'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: SupabaseService,
          useValue: mockSupabase,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    vi.clearAllMocks();
    mockConfigService.get.mockReturnValue('false');
    mockAdminSignOut.mockResolvedValue({ error: null });
    mockAdminDeleteUser.mockResolvedValue({ error: null });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw BadRequestException if consent is missing on syncUser', async () => {
    await expect(
      service.syncUser(
        { supabaseUid: 'sub-123', email: 'test@example.com' },
        {
          nom: 'Diop',
          prenom: 'Fatou',
          pays: 'Sénégal',
          role: UserRole.BENEFICIAIRE,
          consentCgu: false,
          consentData: true,
        },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException if consent is missing on register', async () => {
    await expect(
      service.register({
        email: 'test@example.com',
        password: 'Password123!',
        nom: 'Diop',
        prenom: 'Fatou',
        pays: 'Sénégal',
        role: UserRole.BENEFICIAIRE,
        consentCgu: false,
        consentData: true,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject UserRole.ADMIN on register and syncUser', async () => {
    await expect(
      service.register({
        email: 'admin@example.com',
        password: 'Password123!',
        nom: 'Admin',
        prenom: 'Fake',
        pays: 'Sénégal',
        role: UserRole.ADMIN,
        consentCgu: true,
        consentData: true,
      }),
    ).rejects.toThrow(ForbiddenException);

    await expect(
      service.syncUser(
        { supabaseUid: 'sub-999', email: 'admin@example.com' },
        {
          nom: 'Admin',
          prenom: 'Fake',
          pays: 'Sénégal',
          role: UserRole.ADMIN,
          consentCgu: true,
          consentData: true,
        },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should rollback Supabase Auth user when prisma.user.create fails during register', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'sub-rollback-1' } },
      error: null,
    });
    mockPrisma.user.create.mockRejectedValue(new Error('DB write error'));

    await expect(
      service.register({
        email: 'rollback@example.com',
        password: 'Password123!',
        nom: 'Diop',
        prenom: 'Fatou',
        pays: 'Sénégal',
        role: UserRole.BENEFICIAIRE,
        consentCgu: true,
        consentData: true,
      }),
    ).rejects.toThrow('DB write error');

    expect(mockAdminDeleteUser).toHaveBeenCalledWith('sub-rollback-1');
  });

  it('should revoke session token via admin.signOut during logout', async () => {
    const result = await service.logout('jwt-token-123');
    expect(mockAdminSignOut).toHaveBeenCalledWith('jwt-token-123');
    expect(result.message).toContain('Déconnexion');
  });

  it('should activate PENDING BENEFICIAIRE on verifyOtp while keeping PENDING MENTOR unactivated', async () => {
    mockVerifyOtp.mockResolvedValue({
      data: {
        user: { id: 'sub-ben' },
        session: {
          access_token: 'acc',
          refresh_token: 'ref',
          expires_in: 3600,
          expires_at: 999999,
          token_type: 'bearer',
        },
      },
      error: null,
    });
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'u-ben',
      role: UserRole.BENEFICIAIRE,
      statutCompte: AccountStatus.PENDING,
      diagnostic: null,
    });
    mockPrisma.user.update.mockResolvedValue({
      id: 'u-ben',
      role: UserRole.BENEFICIAIRE,
      statutCompte: AccountStatus.ACTIVE,
      diagnostic: null,
    });

    const resBen = await service.verifyOtp({
      email: 'ben@example.com',
      token: '123456',
    });
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u-ben' },
        data: { statutCompte: AccountStatus.ACTIVE },
      }),
    );
    expect(resBen.user?.statutCompte).toBe(AccountStatus.ACTIVE);

    vi.clearAllMocks();
    mockVerifyOtp.mockResolvedValue({
      data: { user: { id: 'sub-men' }, session: null },
      error: null,
    });
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'u-men',
      role: UserRole.MENTOR,
      statutCompte: AccountStatus.PENDING,
      mentorProfile: null,
    });

    const resMen = await service.verifyOtp({
      email: 'men@example.com',
      token: '123456',
    });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(resMen.user?.statutCompte).toBe(AccountStatus.PENDING);
  });

  it('rejects non-PDF base64 CV during mentor register before hitting Supabase Auth', async () => {
    const fakeNotPdf = Buffer.from('NOT-A-PDF-HEADER').toString('base64');

    await expect(
      service.register({
        email: 'mentor-bad-cv@example.com',
        password: 'Password123!',
        nom: 'Diallo',
        prenom: 'Oumar',
        pays: 'Sénégal',
        role: UserRole.MENTOR,
        consentCgu: true,
        consentData: true,
        cvBase64: fakeNotPdf,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('supports tokenHash OTP verification for email callback links', async () => {
    mockVerifyOtp.mockResolvedValue({
      data: {
        user: { id: 'sub-hash-1', email: 'hash@example.com' },
        session: {
          access_token: 'acc-hash',
          refresh_token: 'ref-hash',
          expires_in: 3600,
          expires_at: 999999,
          token_type: 'bearer',
        },
      },
      error: null,
    });
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'u-hash',
      role: UserRole.BENEFICIAIRE,
      statutCompte: AccountStatus.ACTIVE,
      diagnostic: { isCompleted: true },
    });

    const result = await service.verifyOtp({
      tokenHash: 'hash-token-value',
      type: 'recovery',
    });

    expect(mockVerifyOtp).toHaveBeenCalledWith({
      token_hash: 'hash-token-value',
      type: 'recovery',
    });
    expect(result.session?.accessToken).toBe('acc-hash');
  });

  it('passes emailRedirectTo pointing to /auth/callback during standard signUp', async () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'FRONTEND_URL') return 'https://acceent-mentoring.vercel.app/';
      return 'false';
    });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'sub-redirect-1' }, session: null },
      error: null,
    });
    mockPrisma.user.create.mockResolvedValue({
      id: 'u-redirect-1',
      role: UserRole.BENEFICIAIRE,
      statutCompte: AccountStatus.ACTIVE,
      diagnostic: null,
    });

    await service.register({
      email: 'redirect@example.com',
      password: 'Password123!',
      nom: 'Sarr',
      prenom: 'Moussa',
      pays: 'Sénégal',
      role: UserRole.BENEFICIAIRE,
      consentCgu: true,
      consentData: true,
    });

    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'redirect@example.com',
        options: expect.objectContaining({
          emailRedirectTo: 'https://acceent-mentoring.vercel.app/auth/callback',
        }),
      }),
    );
  });
});
