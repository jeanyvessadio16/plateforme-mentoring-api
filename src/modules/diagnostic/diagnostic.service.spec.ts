import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DiagnosticService } from './diagnostic.service.js';
import { PrismaService } from '../../core/database/prisma.service.js';
import { MatchingService } from '../matching/matching.service.js';

describe('DiagnosticService', () => {
  let service: DiagnosticService;

  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
    },
    diagnostic: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
    userProfile: {
      upsert: vi.fn(),
    },
  };

  const mockMatching = {
    computeMatchingForUser: vi.fn().mockResolvedValue([
      {
        mentorId: 'mentor-1',
        nom: 'Diallo',
        prenom: 'Awa',
        scoreTotal: 92.5,
      },
    ]),
    getRecommendations: vi.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiagnosticService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: MatchingService,
          useValue: mockMatching,
        },
      ],
    }).compile();

    service = module.get<DiagnosticService>(DiagnosticService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should submit diagnostic and trigger matching', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-123',
      profile: { competences: ['HTML'], objectifs: ['Trouver un stage'] },
    });

    mockPrisma.diagnostic.upsert.mockResolvedValue({
      id: 'diag-1',
      userId: 'user-123',
      isCompleted: true,
      situation: 'ETUDIANT',
      domaine: 'NUMERIQUE',
    });

    mockPrisma.userProfile.upsert.mockResolvedValue({});

    const result = await service.submitDiagnostic('user-123', {
      situation: 'ETUDIANT',
      objectifPrincipal: 'Devenir Développeur Fullstack',
      domaine: 'NUMERIQUE',
      niveau: 'DEBUTANT',
      typeAccompagnement: 'INDIVIDUEL',
      competences: ['TypeScript', 'NestJS'],
      besoins: ['Mentorat technique'],
      secteur: 'Informatique & Télécoms',
      disponibilite: 'SOIR_ET_WEEKEND',
      preferenceMentoring: 'VIRTUEL',
    });

    expect(result.message).toContain('succès');
    expect(result.redirectUrl).toBe('/dashboard/beneficiaire');
    expect(result.recommendationsCount).toBe(1);
    expect(mockMatching.computeMatchingForUser).toHaveBeenCalledWith('user-123');
  });

  it('should recalculate matching for a completed diagnostic', async () => {
    mockPrisma.diagnostic.findUnique.mockResolvedValue({
      id: 'diag-1',
      userId: 'user-123',
      isCompleted: true,
    });

    const result = await service.recalculateMatching('user-123');
    expect(result.recommendationsCount).toBe(1);
    expect(mockMatching.computeMatchingForUser).toHaveBeenCalledWith('user-123');
  });

  it('should throw NotFoundException on recalculateMatching if diagnostic is missing or incomplete', async () => {
    mockPrisma.diagnostic.findUnique.mockResolvedValue(null);
    await expect(service.recalculateMatching('user-123')).rejects.toThrow(NotFoundException);

    mockPrisma.diagnostic.findUnique.mockResolvedValue({
      id: 'diag-1',
      userId: 'user-123',
      isCompleted: false,
    });
    await expect(service.recalculateMatching('user-123')).rejects.toThrow(NotFoundException);
  });
});
