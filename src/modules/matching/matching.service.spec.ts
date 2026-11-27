import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { MatchingService } from './matching.service.js';
import { PrismaService } from '../../core/database/prisma.service.js';
import { AccountStatus, MentorshipType } from '../../generated/prisma/client.js';

describe('MatchingService', () => {
  let service: MatchingService;

  const mockPrisma = {
    diagnostic: {
      findUnique: vi.fn(),
    },
    mentorProfile: {
      findMany: vi.fn(),
    },
    matchingWeightConfig: {
      findFirst: vi.fn(),
    },
    matchingResult: {
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchingService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<MatchingService>(MatchingService);
    vi.clearAllMocks();
    mockPrisma.matchingResult.upsert.mockImplementation((args) => args);
    mockPrisma.$transaction.mockResolvedValue([]);
  });

  const sampleDiagnostic = {
    userId: 'mentee-1',
    isCompleted: true,
    objectifPrincipal: 'Développer une application React et NestJS',
    domaine: 'NUMERIQUE',
    niveau: 'INTERMEDIAIRE',
    secteur: 'Informatique',
    competences: ['React', 'NestJS'],
    besoins: ['Architecture'],
    disponibilite: 'SOIR',
    typeAccompagnement: 'INDIVIDUEL',
    user: {
      langue: 'fr',
      profile: { langues: ['fr'] },
    },
  };

  const mentorsFixture = [
    {
      id: 'mp-low',
      userId: 'u-low',
      fonction: 'Chef cuisinier',
      organisation: 'Resto',
      anneesExperience: 5,
      expertises: ['Cuisine'],
      secteurs: ['Restauration'],
      langues: ['en'],
      publicsAccompagnes: ['Artisans'],
      typesMentoring: MentorshipType.COLLECTIF,
      disponibilites: 'SEMAINE',
      biographie: 'Cuisine traditionnelle',
      photoUrl: null,
      statutValidation: AccountStatus.ACTIVE,
      isAvailable: true,
      user: {
        nom: 'Ndiaye',
        prenom: 'Moussa',
        email: 'moussa@example.com',
        profile: { photoUrl: null },
      },
    },
    {
      id: 'mp-high',
      userId: 'u-high',
      fonction: 'Tech Lead',
      organisation: 'ACCEENT Tech',
      anneesExperience: 10,
      expertises: ['React', 'NestJS', 'Architecture'],
      secteurs: ['Informatique'],
      langues: ['fr'],
      publicsAccompagnes: ['Développeurs'],
      typesMentoring: MentorshipType.INDIVIDUEL,
      disponibilites: 'SOIR',
      biographie: 'Accompagnement numerique niveau intermediaire',
      photoUrl: null,
      statutValidation: AccountStatus.ACTIVE,
      isAvailable: true,
      user: {
        nom: 'Diallo',
        prenom: 'Awa',
        email: 'awa@example.com',
        profile: { photoUrl: null },
      },
    },
  ];

  it('should compute scores with default weights, sort descending, and batch upsert in one transaction', async () => {
    mockPrisma.diagnostic.findUnique.mockResolvedValue(sampleDiagnostic);
    mockPrisma.mentorProfile.findMany.mockResolvedValue(mentorsFixture);
    mockPrisma.matchingWeightConfig.findFirst.mockResolvedValue(null);

    const results = await service.computeMatchingForUser('mentee-1');

    expect(results).toHaveLength(2);
    expect(results[0].mentorProfileId).toBe('mp-high');
    expect(results[0].scoreTotal).toBeGreaterThan(results[1].scoreTotal);
    expect(results[0].scoreTotal).toBeGreaterThan(80);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.$transaction.mock.calls[0][0]).toHaveLength(2);
  });

  it('should use custom MatchingWeightConfig from database when present', async () => {
    mockPrisma.diagnostic.findUnique.mockResolvedValue(sampleDiagnostic);
    mockPrisma.mentorProfile.findMany.mockResolvedValue([mentorsFixture[0]]);
    mockPrisma.matchingWeightConfig.findFirst.mockResolvedValue({
      expertiseWeight: 0,
      objectiveWeight: 0,
      sectorWeight: 0,
      availabilityWeight: 1,
      languageWeight: 0,
      formatWeight: 0,
    });

    const results = await service.computeMatchingForUser('mentee-1');

    // availabilityScore baseline for mismatched slot ('SOIR' vs 'SEMAINE') is 60
    expect(results).toHaveLength(1);
    expect(results[0].scoreTotal).toBe(60);
  });

  it("matches 'fr' user language with 'Français' mentor language at 100%", async () => {
    mockPrisma.diagnostic.findUnique.mockResolvedValue({
      ...sampleDiagnostic,
      user: {
        langue: 'fr',
        profile: { langues: [] },
      },
    });
    mockPrisma.mentorProfile.findMany.mockResolvedValue([
      {
        ...mentorsFixture[1],
        langues: ['Français', 'Anglais'],
      },
    ]);
    mockPrisma.matchingWeightConfig.findFirst.mockResolvedValue(null);

    const results = await service.computeMatchingForUser('mentee-1');

    expect(results).toHaveLength(1);
    expect(results[0].detailsScores.languageScore).toBe(100);
  });

  it('filters cached recommendations to active and available mentors only', async () => {
    mockPrisma.matchingResult.findMany.mockResolvedValue([
      {
        scoreTotal: 92,
        detailsScores: {
          expertiseScore: 100,
          objectiveScore: 90,
          sectorScore: 100,
          availabilityScore: 95,
          languageScore: 100,
          formatScore: 100,
        },
        justification: 'Forte synergie.',
        mentor: mentorsFixture[1],
      },
    ]);

    const recs = await service.getRecommendations('mentee-1');

    expect(recs).toHaveLength(1);
    expect(mockPrisma.matchingResult.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          menteeId: 'mentee-1',
          mentor: {
            statutValidation: AccountStatus.ACTIVE,
            isAvailable: true,
            user: { statutCompte: AccountStatus.ACTIVE },
          },
        },
      }),
    );
  });
});
