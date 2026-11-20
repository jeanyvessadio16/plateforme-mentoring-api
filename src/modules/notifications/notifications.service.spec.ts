import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import { PrismaService } from '../../core/database/prisma.service.js';
import { MailService } from '../../core/mail/mail.service.js';
import { NotificationType } from '../../generated/prisma/client.js';

describe('NotificationsService', () => {
  let service: NotificationsService;

  const mockPrisma = {
    notification: {
      create: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  };

  const mockMailService = {
    sendNotificationEmail: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('lists notifications with unreadCount', async () => {
    mockPrisma.notification.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    mockPrisma.notification.findMany.mockResolvedValue([
      { id: 'n1', userId: 'u1', isRead: false },
    ]);

    const res = await service.listForUser('u1', { page: 1, limit: 20 });

    expect(res.unreadCount).toBe(1);
    expect(res.data).toHaveLength(1);
  });

  it('rejects marking another user notification as read', async () => {
    mockPrisma.notification.findUnique.mockResolvedValue({
      id: 'n1',
      userId: 'other-user',
      isRead: false,
    });

    await expect(service.markAsRead('u1', 'n1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('throws NotFoundException when deleting missing notification', async () => {
    mockPrisma.notification.findUnique.mockResolvedValue(null);

    await expect(service.deleteNotification('u1', 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('swallows errors in async event handler so business actions never fail', async () => {
    mockPrisma.notification.create.mockRejectedValue(new Error('DB busy'));

    await expect(
      service.handleNotificationEvent({
        userId: 'u1',
        type: NotificationType.SYSTEM,
        titre: 'Test',
        message: 'Message',
      }),
    ).resolves.toBeUndefined();
  });

  it('triggers non-blocking notification email when DEMANDE event is handled', async () => {
    mockPrisma.notification.create.mockResolvedValue({ id: 'n2' });
    mockPrisma.user.findUnique.mockResolvedValue({
      email: 'mentor@example.com',
      prenom: 'Awa',
      nom: 'Diop',
    });
    mockMailService.sendNotificationEmail.mockRejectedValue(
      new Error('SMTP timeout'),
    );

    await expect(
      service.handleNotificationEvent({
        userId: 'm1',
        type: NotificationType.DEMANDE,
        titre: 'Nouvelle demande',
        message: 'Un mentoré vous sollicite.',
      }),
    ).resolves.toBeUndefined();

    expect(mockMailService.sendNotificationEmail).toHaveBeenCalledWith(
      'mentor@example.com',
      'Awa Diop',
      'Nouvelle demande',
      'Un mentoré vous sollicite.',
    );
  });
});
