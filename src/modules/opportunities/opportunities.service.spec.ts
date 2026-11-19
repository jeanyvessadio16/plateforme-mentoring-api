import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { OpportunitiesService } from './opportunities.service.js';
import { PrismaService } from '../../core/database/prisma.service.js';
import { OpportunityStatus } from '../../generated/prisma/client.js';

describe('OpportunitiesService', () => {
  let service: OpportunitiesService;

  const mockPrisma = {
    opportunity: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    opportunityFavorite: {
      upsert: vi.fn(),
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

  it('filters active non-expired opportunities by default', async () => {
    mockPrisma.opportunity.count.mockResolvedValue(1);
    mockPrisma.opportunity.findMany.mockResolvedValue([{ id: 'opp-1' }]);

    await service.findAll({ page: 1, limit: 12 });

    const countArg = mockPrisma.opportunity.count.mock.calls[0][0];
    expect(countArg.where.status).toBe(OpportunityStatus.ACTIVE);
    expect(countArg.where.dateExpiration).toBeDefined();
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
