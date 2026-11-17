import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../../core/database/prisma.service.js';
import { BadRequestException } from '@nestjs/common';
import { UserRole } from '../../generated/prisma/client.js';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;

  const mockPrisma = {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw BadRequestException if consent is missing', async () => {
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
});
