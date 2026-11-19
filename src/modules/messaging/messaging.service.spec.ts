import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MessagingService } from './messaging.service.js';
import { PrismaService } from '../../core/database/prisma.service.js';
import { UserRole } from '../../generated/prisma/client.js';

describe('MessagingService', () => {
  let service: MessagingService;

  const mockTx = {
    message: { create: vi.fn() },
    conversation: { update: vi.fn() },
  };

  const mockPrisma = {
    user: { findUnique: vi.fn() },
    mentorProfile: { findUnique: vi.fn() },
    conversation: { findUnique: vi.fn(), upsert: vi.fn(), findMany: vi.fn() },
    mentorshipProgram: { findFirst: vi.fn() },
    mentorshipSession: { findFirst: vi.fn() },
    mentorshipRequest: { findFirst: vi.fn() },
    message: { groupBy: vi.fn(), count: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(async (cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
  };

  const mockEmitter = { emit: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEmitter },
      ],
    }).compile();

    service = module.get<MessagingService>(MessagingService);
  });

  it('blocks conversation between unrelated users (F10 access rule)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-b',
      role: UserRole.BENEFICIAIRE,
      nom: 'Diop',
      prenom: 'Binta',
    });
    mockPrisma.conversation.findUnique.mockResolvedValue(null);
    mockPrisma.mentorshipProgram.findFirst.mockResolvedValue(null);
    mockPrisma.mentorshipSession.findFirst.mockResolvedValue(null);
    mockPrisma.mentorshipRequest.findFirst.mockResolvedValue(null);

    await expect(
      service.startOrGetConversation('user-a', UserRole.BENEFICIAIRE, 'user-b'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows conversation and orders participants deterministically when linked by program', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-a',
      role: UserRole.MENTOR,
      nom: 'Fall',
      prenom: 'Oumar',
    });
    mockPrisma.conversation.findUnique.mockResolvedValue(null);
    mockPrisma.mentorshipProgram.findFirst.mockResolvedValue({ id: 'prog-1' });
    mockPrisma.mentorshipSession.findFirst.mockResolvedValue(null);
    mockPrisma.mentorshipRequest.findFirst.mockResolvedValue(null);
    mockPrisma.conversation.upsert.mockResolvedValue({
      id: 'conv-1',
      participant1Id: 'user-a',
      participant2Id: 'user-z',
    });

    const conv = await service.startOrGetConversation(
      'user-z',
      UserRole.BENEFICIAIRE,
      'user-a',
    );
    expect(conv.id).toBe('conv-1');
    expect(mockPrisma.conversation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          participant1Id_participant2Id: {
            participant1Id: 'user-a',
            participant2Id: 'user-z',
          },
        },
      }),
    );
  });

  it('forbids non-participant from reading conversation messages', async () => {
    mockPrisma.conversation.findUnique.mockResolvedValue({
      id: 'conv-1',
      participant1Id: 'u1',
      participant2Id: 'u2',
      participant1: {},
      participant2: {},
    });

    await expect(
      service.getMessages('intruder', 'conv-1', { page: 1, limit: 30 }),
    ).rejects.toThrow(ForbiddenException);
  });
});
