import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../core/database/prisma.service.js';
import type { NotificationType, Prisma } from '../../generated/prisma/client.js';
import type { ListNotificationsDto } from './dto/list-notifications.dto.js';

export const NOTIFICATION_CREATE_EVENT = 'notification.create';

export interface CreateNotificationEvent {
  userId: string;
  type: NotificationType;
  titre: string;
  message: string;
  data?: Prisma.InputJsonValue;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createNotification(payload: CreateNotificationEvent) {
    return this.prisma.notification.create({
      data: {
        userId: payload.userId,
        type: payload.type,
        titre: payload.titre,
        message: payload.message,
        data: payload.data,
      },
    });
  }

  @OnEvent(NOTIFICATION_CREATE_EVENT)
  async handleNotificationEvent(payload: CreateNotificationEvent): Promise<void> {
    try {
      await this.createNotification(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Échec asynchrone lors de la création de notification (${payload.type}) pour ${payload.userId}: ${message}`,
      );
    }
  }

  async listForUser(userId: string, query: ListNotificationsDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = { userId };
    if (query.unreadOnly) {
      where.isRead = false;
    }

    const [total, unreadCount, data] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data,
      unreadCount,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException('Notification introuvable.');
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException(
        'Vous ne pouvez pas modifier la notification d’un autre utilisateur.',
      );
    }

    if (notification.isRead) {
      return notification;
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return {
      message: 'Toutes les notifications ont été marquées comme lues.',
      updatedCount: result.count,
    };
  }

  async deleteNotification(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException('Notification introuvable.');
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException(
        'Vous ne pouvez pas supprimer la notification d’un autre utilisateur.',
      );
    }

    await this.prisma.notification.delete({
      where: { id: notificationId },
    });

    return { message: 'Notification supprimée.' };
  }
}
