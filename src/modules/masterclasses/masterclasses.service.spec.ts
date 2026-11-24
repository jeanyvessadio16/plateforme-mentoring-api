import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MasterclassesService } from './masterclasses.service.js';
import { PrismaService } from '../../core/database/prisma.service.js';
import { AccountStatus, MasterclassStatus, UserRole } from '../../generated/prisma/client.js';

describe('MasterclassesService', () => {
  let service: MasterclassesService;

  const mockPrisma = {
    masterclass: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    masterclassRegistration: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  };

  const mockEmitter = { emit: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MasterclassesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEmitter },
      ],
    }).compile();

    service = module.get<MasterclassesService>(MasterclassesService);
  });

  it('excludes lienLive and lienReplay in public catalog queries', async () => {
    mockPrisma.masterclass.count.mockResolvedValue(1);
    mockPrisma.masterclass.findMany.mockResolvedValue([{ id: 'mc1', titre: 'Pitch' }]);

    await service.findPublicMasterclasses({ page: 1, limit: 12 });

    const callArg = mockPrisma.masterclass.findMany.mock.calls[0][0];
    expect(callArg.select.lienLive).toBeUndefined();
    expect(callArg.select.lienReplay).toBeUndefined();
  });

  it('denies live/replay link access to unregistered beneficiary', async () => {
    mockPrisma.masterclass.findUnique.mockResolvedValue({
      id: 'mc1',
      titre: 'Pitch',
      statut: MasterclassStatus.UPCOMING,
      lienLive: 'https://meet.example.com/123',
      lienReplay: null,
    });
    mockPrisma.masterclassRegistration.findUnique.mockResolvedValue(null);

    await expect(
      service.getAccessLinks('mc1', 'u1', UserRole.BENEFICIAIRE),
    ).rejects.toThrow(ForbiddenException);
  });

  it('blocks registration when maxParticipants capacity is reached', async () => {
    mockPrisma.masterclass.findUnique.mockResolvedValue({
      id: 'mc1',
      titre: 'Atelier IA',
      statut: MasterclassStatus.UPCOMING,
      maxParticipants: 20,
      dateSession: new Date('2026-12-10T15:00:00.000Z'),
      _count: { registrations: 20 },
    });
    mockPrisma.masterclassRegistration.findUnique.mockResolvedValue(null);

    await expect(service.register('mc1', 'u1')).rejects.toThrow(ConflictException);
  });

  it('denies live/replay link bypass to unvalidated PENDING expert', async () => {
    mockPrisma.masterclass.findUnique.mockResolvedValue({
      id: 'mc1',
      titre: 'Pitch',
      statut: MasterclassStatus.UPCOMING,
      lienLive: 'https://meet.example.com/123',
      lienReplay: null,
    });
    mockPrisma.masterclassRegistration.findUnique.mockResolvedValue(null);

    await expect(
      service.getAccessLinks('mc1', 'exp-pending', UserRole.EXPERT, AccountStatus.PENDING),
    ).rejects.toThrow(ForbiddenException);
  });
});
