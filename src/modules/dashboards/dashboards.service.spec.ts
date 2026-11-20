import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { DashboardsService } from './dashboards.service.js';
import { PrismaService } from '../../core/database/prisma.service.js';
import { AccountStatus, UserRole } from '../../generated/prisma/client.js';

describe('DashboardsService', () => {
  let service: DashboardsService;

  const mockPrisma = {
    user: { findUnique: vi.fn(), count: vi.fn() },
    mentorProfile: { count: vi.fn(), findMany: vi.fn() },
    mentorshipProgram: { findMany: vi.fn(), count: vi.fn() },
    mentorshipRequest: { findMany: vi.fn(), count: vi.fn() },
    mentorshipSession: { findMany: vi.fn(), count: vi.fn(), aggregate: vi.fn() },
    matchingResult: { findMany: vi.fn() },
    opportunity: { findMany: vi.fn(), count: vi.fn() },
    masterclass: { findMany: vi.fn(), count: vi.fn() },
    availabilitySlot: { findMany: vi.fn() },
    mentorshipTask: { count: vi.fn() },
    message: { count: vi.fn() },
    notification: { count: vi.fn() },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DashboardsService>(DashboardsService);
  });

  it('aggregates beneficiary dashboard without exposing private mentor CV fields', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'b1',
      nom: 'Sow',
      prenom: 'Aminata',
      email: 'a@example.com',
      telephone: '+221770000000',
      pays: 'Sénégal',
      role: UserRole.BENEFICIAIRE,
      age: 24,
      sexe: null,
      milieuResidence: null,
      situationHandicap: false,
      statutCompte: AccountStatus.ACTIVE,
      profile: {
        ville: 'Dakar',
        niveauEtude: 'Master',
        secteurActivite: 'Tech',
        competences: ['JS'],
        objectifs: ['Emploi'],
        disponibilite: 'Soir',
        photoUrl: null,
      },
      diagnostic: { isCompleted: true },
    });
    mockPrisma.mentorshipProgram.findMany.mockResolvedValue([]);
    mockPrisma.mentorshipSession.findMany.mockResolvedValue([]);
    mockPrisma.mentorshipSession.count.mockResolvedValue(1);
    mockPrisma.matchingResult.findMany.mockResolvedValue([]);
    mockPrisma.mentorProfile.findMany.mockResolvedValue([]);
    mockPrisma.opportunity.findMany.mockResolvedValue([]);
    mockPrisma.masterclass.findMany.mockResolvedValue([]);
    mockPrisma.notification.count.mockResolvedValue(2);

    const res = await service.getBeneficiaryDashboard('b1');

    expect(res.user.profileCompletion).toBe(100);
    expect(res.unreadNotificationsCount).toBe(2);
    expect(res.completedSessionsCount).toBe(1);
    const matchingSelect = mockPrisma.matchingResult.findMany.mock.calls[0][0].select;
    expect(matchingSelect.mentor.select.cvUrl).toBeUndefined();
    const fallbackSelect = mockPrisma.mentorProfile.findMany.mock.calls[0][0].select;
    expect(fallbackSelect.cvUrl).toBeUndefined();
    const mcSelect = mockPrisma.masterclass.findMany.mock.calls[0][0].select;
    expect(mcSelect.lienLive).toBeUndefined();
  });

  it('returns public stats counts', async () => {
    mockPrisma.mentorProfile.count.mockResolvedValue(12);
    mockPrisma.user.count.mockResolvedValue(150);
    mockPrisma.mentorshipSession.count.mockResolvedValue(45);
    mockPrisma.opportunity.count.mockResolvedValue(8);
    mockPrisma.masterclass.count.mockResolvedValueOnce(3).mockResolvedValueOnce(6);

    const stats = await service.getPublicStats();
    expect(stats).toEqual({
      activeMentors: 12,
      activeBeneficiaries: 150,
      completedSessions: 45,
      activeOpportunities: 8,
      upcomingMasterclasses: 3,
      totalMasterclasses: 6,
    });
  });
});
