import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../../core/database/prisma.service.js';
import { SupabaseService } from '../../core/supabase/supabase.service.js';
import { UserRole } from '../../generated/prisma/client.js';

describe('AuthService', () => {
  let service: AuthService;

  const mockAdminSignOut = vi.fn().mockResolvedValue({ error: null });
  const mockAdminCreateUser = vi.fn();
  const mockAdminDeleteUser = vi.fn().mockResolvedValue({ error: null });
  const mockAdminUpdateUser = vi.fn();
  const mockSignUp = vi.fn();
  const mockSignInWithPassword = vi.fn();

  const mockPrisma = {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  };

  const mockSupabase = {
    getClient: vi.fn().mockReturnValue({
      auth: {
        signInWithPassword: mockSignInWithPassword,
        refreshSession: vi.fn(),
        signOut: vi.fn(),
        resetPasswordForEmail: vi.fn(),
        verifyOtp: vi.fn(),
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
});
