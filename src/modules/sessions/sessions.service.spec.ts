import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SessionsService } from './sessions.service.js';
import { PrismaService } from '../../core/database/prisma.service.js';
import { AccountStatus, SessionStatus, UserRole } from '../../generated/prisma/client.js';

describe('SessionsService', () => {
  let service: SessionsService;

  const mockTx = {
    mentorshipSession: { create: vi.fn(), update: vi.fn() },
    availabilitySlot: { update: vi.fn() },
  };

  const mockPrisma = {
    mentorProfile: { findFirst: vi.fn(), findUnique: vi.fn() },
    availabilitySlot: { findUnique: vi.fn(), create: vi.fn(), findMany: vi.fn() },
    mentorshipSession: { findFirst: vi.fn(), findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    $transaction: vi.fn(async (cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
  };

  const mockEmitter = { emit: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEmitter },
      ],
    }).compile();

    service = module.get<SessionsService>(SessionsService);
  });

  it('rejects overlapping sessions for the same mentor', async () => {
    mockPrisma.mentorProfile.findFirst.mockResolvedValue({ userId: 'mentor-1' });
    mockPrisma.mentorProfile.findUnique.mockResolvedValue({
      statutValidation: AccountStatus.ACTIVE,
    });
    mockPrisma.mentorshipSession.findFirst.mockResolvedValue({ id: 'existing' });

    await expect(
      service.bookSession('mentee-1', UserRole.BENEFICIAIRE, {
        mentorId: 'mentor-1',
        titre: 'Point avancement',
        dateDebut: '2026-12-01T10:00:00.000Z',
        dateFin: '2026-12-01T11:00:00.000Z',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('deactivates non-recurring slot when booked and notifies both parties', async () => {
    mockPrisma.mentorProfile.findFirst.mockResolvedValue({ userId: 'mentor-1' });
    mockPrisma.mentorProfile.findUnique.mockResolvedValue({
      statutValidation: AccountStatus.ACTIVE,
    });
    mockPrisma.availabilitySlot.findUnique.mockResolvedValue({
      id: 'slot-1',
      mentorId: 'mentor-1',
      isActive: true,
      isRecurring: false,
    });
    mockPrisma.mentorshipSession.findFirst.mockResolvedValue(null);
    mockTx.mentorshipSession.create.mockResolvedValue({
      id: 'sess-1',
      titre: 'Coaching pitch',
      status: SessionStatus.SCHEDULED,
      mentor: { id: 'mentor-1', nom: 'Diallo', prenom: 'Awa' },
      mentee: { id: 'mentee-1', nom: 'Ndiaye', prenom: 'Ibrahima' },
    });
    mockTx.availabilitySlot.update.mockResolvedValue({});

    const res = await service.bookSession('mentee-1', UserRole.BENEFICIAIRE, {
      mentorId: 'mentor-1',
      slotId: 'slot-1',
      titre: 'Coaching pitch',
      dateDebut: '2026-12-01T10:00:00.000Z',
      dateFin: '2026-12-01T11:00:00.000Z',
    });

    expect(res.id).toBe('sess-1');
    expect(mockTx.availabilitySlot.update).toHaveBeenCalledWith({
      where: { id: 'slot-1' },
      data: { isActive: false },
    });
    expect(mockEmitter.emit).toHaveBeenCalledTimes(2);
  });

  it('reactivates non-recurring slot when session is cancelled', async () => {
    mockPrisma.mentorshipSession.findUnique.mockResolvedValue({
      id: 'sess-1',
      titre: 'Coaching pitch',
      mentorId: 'mentor-1',
      menteeId: 'mentee-1',
      status: SessionStatus.SCHEDULED,
      slot: { id: 'slot-1', isRecurring: false },
    });
    mockTx.mentorshipSession.update.mockResolvedValue({
      id: 'sess-1',
      status: SessionStatus.CANCELLED,
    });

    const res = await service.cancelSession('mentee-1', UserRole.BENEFICIAIRE, 'sess-1');

    expect(res.status).toBe(SessionStatus.CANCELLED);
    expect(mockTx.availabilitySlot.update).toHaveBeenCalledWith({
      where: { id: 'slot-1' },
      data: { isActive: true },
    });
  });
});
