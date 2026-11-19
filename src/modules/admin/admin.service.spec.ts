import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AdminService } from './admin.service.js';
import { PrismaService } from '../../core/database/prisma.service.js';
import { SupabaseService } from '../../core/supabase/supabase.service.js';
import { AccountStatus } from '../../generated/prisma/client.js';

describe('AdminService', () => {
  let service: AdminService;

  const mockPrisma = {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    userProfile: { count: vi.fn() },
    mentorProfile: { count: vi.fn() },
    matchingResult: { count: vi.fn() },
    mentorshipRequest: { count: vi.fn(), findMany: vi.fn() },
    mentorshipProgram: { count: vi.fn() },
    mentorshipSession: { count: vi.fn(), aggregate: vi.fn() },
    masterclass: { count: vi.fn() },
    masterclassRegistration: { count: vi.fn() },
    opportunity: { count: vi.fn() },
    report: { count: vi.fn(), findMany: vi.fn() },
    matchingWeightConfig: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  };

  const mockSupabase = {
    getAdminClient: vi.fn(() => ({
      auth: {
        admin: {
          updateUserById: vi.fn().mockResolvedValue({ error: null }),
        },
      },
    })),
    createSignedUrl: vi.fn(),
  };

  const mockEmitter = { emit: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: EventEmitter2, useValue: mockEmitter },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  it('rejects matching weights whose sum is not 1.0', async () => {
    await expect(
      service.updateMatchingWeights('admin-1', {
        expertiseWeight: 0.5,
        objectiveWeight: 0.5,
        sectorWeight: 0.5,
        availabilityWeight: 0.1,
        languageWeight: 0.1,
        formatWeight: 0.1,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('signs private CV paths in pending validations', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: 'm1',
        email: 'mentor@example.com',
        nom: 'Ndiaye',
        prenom: 'Aissatou',
        role: 'MENTOR',
        statutCompte: AccountStatus.PENDING,
        pays: 'Sénégal',
        createdAt: new Date(),
        mentorProfile: {
          id: 'mp1',
          cvUrl: 'm1/cv-test.pdf',
        },
      },
    ]);
    mockSupabase.createSignedUrl.mockResolvedValue(
      'https://storage.supabase.co/signed-cv',
    );

    const res = await service.getPendingValidations();

    expect(mockSupabase.createSignedUrl).toHaveBeenCalledWith(
      'mentor-documents',
      'm1/cv-test.pdf',
      3600,
    );
    expect(res[0].mentorProfile?.signedCvUrl).toBe(
      'https://storage.supabase.co/signed-cv',
    );
  });

  it('neutralizes CSV formula injection in user export', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: 'u1',
        email: 'bad@example.com',
        nom: '=CMD()',
        prenom: 'Test',
        role: 'BENEFICIAIRE',
        statutCompte: AccountStatus.ACTIVE,
        pays: 'Sénégal',
        age: 22,
        sexe: null,
        milieuResidence: null,
        situationHandicap: false,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);

    const res = await service.exportUsers('csv');
    const text = res.buffer.toString('utf-8');

    expect(text).toContain("'=CMD()");
  });

  it('generates PDF buffer for impact report export', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.userProfile.count.mockResolvedValue(0);
    mockPrisma.mentorProfile.count.mockResolvedValue(0);
    mockPrisma.user.count.mockResolvedValue(0);
    mockPrisma.matchingResult.count.mockResolvedValue(0);
    mockPrisma.mentorshipRequest.count.mockResolvedValue(0);
    mockPrisma.mentorshipProgram.count.mockResolvedValue(0);
    mockPrisma.mentorshipSession.count.mockResolvedValue(0);
    mockPrisma.mentorshipSession.aggregate.mockResolvedValue({ _avg: { rating: null } });
    mockPrisma.masterclass.count.mockResolvedValue(0);
    mockPrisma.masterclassRegistration.count.mockResolvedValue(0);
    mockPrisma.opportunity.count.mockResolvedValue(0);
    mockPrisma.report.count.mockResolvedValue(0);

    const pdf = await service.exportImpactReport('pdf');

    expect(pdf.contentType).toBe('application/pdf');
    expect(pdf.buffer.subarray(0, 4).toString('utf-8')).toBe('%PDF');
  });
});
