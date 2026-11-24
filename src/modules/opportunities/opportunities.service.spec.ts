import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { OpportunitiesService } from './opportunities.service.js';
import { PrismaService } from '../../core/database/prisma.service.js';
import {
  AccountStatus,
  NotificationType,
  OpportunityCategory,
  OpportunityStatus,
  UserRole,
} from '../../generated/prisma/client.js';

describe('OpportunitiesService', () => {
  let service: OpportunitiesService;

  const mockPrisma = {
    opportunity: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    opportunityFavorite: {
      upsert: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
    notification: {
      createMany: vi.fn(),
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpportunitiesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<OpportunitiesService>(OpportunitiesService);
  });

  it('filters active non-expired opportunities by default and when status=ACTIVE is passed explicitly', async () => {
    mockPrisma.opportunity.count.mockResolvedValue(1);
    mockPrisma.opportunity.findMany.mockResolvedValue([{ id: 'opp-1' }]);

    await service.findAll({ page: 1, limit: 12 });

    const countArg = mockPrisma.opportunity.count.mock.calls[0][0];
    expect(countArg.where.status).toBe(OpportunityStatus.ACTIVE);
    expect(countArg.where.dateExpiration).toBeDefined();

    await service.findAll({ status: OpportunityStatus.ACTIVE, page: 1, limit: 12 });
    const explicitArg = mockPrisma.opportunity.count.mock.calls[1][0];
    expect(explicitArg.where.status).toBe(OpportunityStatus.ACTIVE);
    expect(explicitArg.where.dateExpiration).toBeDefined();
  });

  it('notifies active beneficiaries when a new opportunity is created (F15)', async () => {
    mockPrisma.opportunity.create.mockResolvedValue({
      id: 'opp-new',
      titre: 'Bourse Tech Dakar',
      organisation: 'ACCEENT',
      categorie: OpportunityCategory.BOURSE,
      status: OpportunityStatus.ACTIVE,
    });
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'ben-1' }, { id: 'ben-2' }]);
    mockPrisma.notification.createMany.mockResolvedValue({ count: 2 });

    const created = await service.create({
      titre: 'Bourse Tech Dakar',
      organisation: 'ACCEENT',
      categorie: OpportunityCategory.BOURSE,
      description: 'Programme intensif',
      lienCandidature: 'https://acceent.sn/apply',
      dateExpiration: '2027-01-15T00:00:00.000Z',
    });

    expect(created.id).toBe('opp-new');
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { role: UserRole.BENEFICIAIRE, statutCompte: AccountStatus.ACTIVE },
      }),
    );
    expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: 'ben-1',
          type: NotificationType.OPPORTUNITE,
          data: { opportunityId: 'opp-new' },
        }),
        expect.objectContaining({
          userId: 'ben-2',
          type: NotificationType.OPPORTUNITE,
          data: { opportunityId: 'opp-new' },
        }),
      ],
    });
  });

  it('archives expired opportunities in bulk via cron method', async () => {
    mockPrisma.opportunity.updateMany.mockResolvedValue({ count: 3 });

    const count = await service.archiveExpiredOpportunities();

    expect(count).toBe(3);
    expect(mockPrisma.opportunity.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: OpportunityStatus.EXPIRED },
      }),
    );
  });
});
