import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../../core/database/prisma.service.js';
import { SupabaseService } from '../../core/supabase/supabase.service.js';
import { BadRequestException } from '@nestjs/common';
import { UserRole } from '../../generated/prisma/client.js';

describe('AuthService', () => {
  let service: AuthService;

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
        signInWithPassword: vi.fn(),
        refreshSession: vi.fn(),
        signOut: vi.fn(),
        resetPasswordForEmail: vi.fn(),
        verifyOtp: vi.fn(),
        signUp: vi.fn(),
      },
    }),
    getAdminClient: vi.fn().mockReturnValue({
      auth: {
        admin: {
          createUser: vi.fn(),
          updateUserById: vi.fn(),
          deleteUser: vi.fn(),
        },
      },
    }),
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
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    vi.clearAllMocks();
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
});
