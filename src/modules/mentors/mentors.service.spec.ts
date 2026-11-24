import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { MentorsService } from './mentors.service.js';
import { PrismaService } from '../../core/database/prisma.service.js';
import { AccountStatus } from '../../generated/prisma/client.js';

describe('MentorsService', () => {
  let service: MentorsService;

  const mockPrisma = {
    mentorProfile: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MentorsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<MentorsService>(MentorsService);
  });

  it('filters expertise, secteur and langue case-insensitively and partially (F06)', async () => {
    mockPrisma.mentorProfile.findMany.mockResolvedValue([
      {
        id: 'mp-1',
        userId: 'u-1',
        fonction: 'Directrice Financière',
        organisation: 'FinLab',
        anneesExperience: 8,
        expertises: ['Comptabilité & Finance', 'Levée de fonds'],
        secteurs: ['Finance & Banque'],
        langues: ['Français', 'Anglais'],
        statutValidation: AccountStatus.ACTIVE,
        isAvailable: true,
        user: { id: 'u-1', nom: 'Diop', prenom: 'Awa', pays: 'Sénégal' },
      },
      {
        id: 'mp-2',
        userId: 'u-2',
        fonction: 'Lead Dev',
        organisation: 'TechCo',
        anneesExperience: 5,
        expertises: ['Développement Web'],
        secteurs: ['Numérique & Tech'],
        langues: ['Wolof'],
        statutValidation: AccountStatus.ACTIVE,
        isAvailable: true,
        user: { id: 'u-2', nom: 'Fall', prenom: 'Moussa', pays: 'Sénégal' },
      },
    ]);

    const res = await service.findMentors({
      expertise: 'finance',
      secteur: 'banque',
      langue: 'fr',
      page: 1,
      limit: 10,
    });

    expect(res.meta.total).toBe(1);
    expect(res.data).toHaveLength(1);
    expect(res.data[0].id).toBe('mp-1');
  });

  it('uses direct Prisma pagination when no array filter is specified', async () => {
    mockPrisma.mentorProfile.count.mockResolvedValue(1);
    mockPrisma.mentorProfile.findMany.mockResolvedValue([{ id: 'mp-1' }]);

    const res = await service.findMentors({ page: 1, limit: 10 });

    expect(mockPrisma.mentorProfile.count).toHaveBeenCalledOnce();
    expect(res.meta.total).toBe(1);
    expect(res.data).toHaveLength(1);
  });
});
