import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MentoringService } from './mentoring.service.js';
import { PrismaService } from '../../core/database/prisma.service.js';
import {
  AccountStatus,
  ProgramStatus,
  RequestStatus,
  TaskStatus,
  UserRole,
} from '../../generated/prisma/client.js';

describe('MentoringService', () => {
  let service: MentoringService;

  const mockTx = {
    mentorshipRequest: { update: vi.fn() },
    mentorshipProgram: { create: vi.fn() },
  };

  const mockPrisma = {
    mentorProfile: { findFirst: vi.fn() },
    mentorshipRequest: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    mentorshipProgram: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    mentorshipGoal: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    mentorshipTask: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(async (cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
  };

  const mockEmitter = { emit: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MentoringService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEmitter },
      ],
    }).compile();

    service = module.get<MentoringService>(MentoringService);
  });

  it('prevents self mentorship request', async () => {
    mockPrisma.mentorProfile.findFirst.mockResolvedValue({
      id: 'mp1',
      userId: 'u1',
      statutValidation: AccountStatus.ACTIVE,
      isAvailable: true,
      user: { id: 'u1', nom: 'Diop', prenom: 'Amadou', statutCompte: AccountStatus.ACTIVE },
    });

    await expect(
      service.createRequest('u1', {
        mentorId: 'u1',
        objectif: 'Lancer projet',
        problematique: 'Besoin structuration',
        duree: '3 mois',
        frequence: '2/mois',
        format: 'INDIVIDUEL',
        message: 'Bonjour',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('prevents duplicate pending mentorship request', async () => {
    mockPrisma.mentorProfile.findFirst.mockResolvedValue({
      id: 'mp1',
      userId: 'mentor-1',
      statutValidation: AccountStatus.ACTIVE,
      isAvailable: true,
      user: { id: 'mentor-1', nom: 'Diop', prenom: 'Awa', statutCompte: AccountStatus.ACTIVE },
    });
    mockPrisma.mentorshipRequest.findFirst.mockResolvedValue({ id: 'req-existing' });

    await expect(
      service.createRequest('mentee-1', {
        mentorId: 'mentor-1',
        objectif: 'Lancer projet',
        problematique: 'Contexte',
        duree: '3 mois',
        frequence: '2/mois',
        format: 'INDIVIDUEL',
        message: 'Bonjour',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('creates MentorshipProgram when mentor accepts a pending request', async () => {
    mockPrisma.mentorshipRequest.findUnique.mockResolvedValue({
      id: 'req-1',
      mentorId: 'mentor-1',
      menteeId: 'mentee-1',
      objectif: 'Lever des fonds',
      problematique: 'Pitch deck',
      status: RequestStatus.PENDING,
      mentor: { id: 'mentor-1', nom: 'Fall', prenom: 'Moussa' },
      program: null,
    });
    mockTx.mentorshipRequest.update.mockResolvedValue({
      id: 'req-1',
      status: RequestStatus.ACCEPTED,
    });
    mockTx.mentorshipProgram.create.mockResolvedValue({
      id: 'prog-1',
      status: ProgramStatus.ACTIVE,
    });

    const result = await service.respondToRequest('mentor-1', UserRole.MENTOR, 'req-1', {
      action: 'ACCEPT',
      responseMessage: 'Avec plaisir',
    });

    expect(result.program).toEqual({ id: 'prog-1', status: ProgramStatus.ACTIVE });
    expect(mockEmitter.emit).toHaveBeenCalledOnce();
  });

  it('recalculates progression when task status changes', async () => {
    mockPrisma.mentorshipProgram.findUnique.mockResolvedValue({
      id: 'prog-1',
      mentorId: 'mentor-1',
      menteeId: 'mentee-1',
    });
    mockPrisma.mentorshipTask.findFirst.mockResolvedValue({ id: 'task-1', programId: 'prog-1' });
    mockPrisma.mentorshipTask.update.mockResolvedValue({
      id: 'task-1',
      status: TaskStatus.COMPLETED,
    });
    mockPrisma.mentorshipTask.findMany.mockResolvedValue([
      { status: TaskStatus.COMPLETED },
      { status: TaskStatus.PENDING },
    ]);
    mockPrisma.mentorshipGoal.findMany.mockResolvedValue([]);
    mockPrisma.mentorshipProgram.update.mockResolvedValue({});

    const res = await service.updateTask('mentee-1', UserRole.BENEFICIAIRE, 'prog-1', 'task-1', {
      status: TaskStatus.COMPLETED,
    });

    expect(res.progression).toBe(50);
  });

  it('forbids non-participant from reading program', async () => {
    mockPrisma.mentorshipProgram.findUnique.mockResolvedValue({
      id: 'prog-1',
      mentorId: 'mentor-1',
      menteeId: 'mentee-1',
    });

    await expect(
      service.getProgramById('intruder', UserRole.BENEFICIAIRE, 'prog-1'),
    ).rejects.toThrow(ForbiddenException);
  });
});
