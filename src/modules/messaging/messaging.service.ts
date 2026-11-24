import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../core/database/prisma.service.js';
import { SupabaseService } from '../../core/supabase/supabase.service.js';
import {
  NotificationType,
  RequestStatus,
  UserRole,
} from '../../generated/prisma/client.js';
import {
  NOTIFICATION_CREATE_EVENT,
  type CreateNotificationEvent,
} from '../notifications/notifications.service.js';
import type { SendMessageDto } from './dto/send-message.dto.js';
import type { ListMessagesDto } from './dto/list-messages.dto.js';
import type { UploadAttachmentDto } from './dto/upload-attachment.dto.js';

const ATTACHMENT_BUCKET = 'mentor-documents';
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

@Injectable()
export class MessagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    @Optional() private readonly supabaseService?: SupabaseService,
  ) {}

  private emitNotification(payload: CreateNotificationEvent): void {
    this.eventEmitter.emit(NOTIFICATION_CREATE_EVENT, payload);
  }

  private getOrderedParticipants(userA: string, userB: string): [string, string] {
    return userA < userB ? [userA, userB] : [userB, userA];
  }

  private async assertCanCommunicate(
    userId: string,
    userRole: UserRole,
    recipientId: string,
    recipientRole: UserRole,
  ) {
    if (userId === recipientId) {
      throw new BadRequestException(
        'Vous ne pouvez pas démarrer une conversation avec vous-même.',
      );
    }

    if (userRole === UserRole.ADMIN || recipientRole === UserRole.ADMIN) {
      return;
    }

    const [p1, p2] = this.getOrderedParticipants(userId, recipientId);

    const [existingConv, existingProgram, existingSession, existingRequest] =
      await Promise.all([
        this.prisma.conversation.findUnique({
          where: { participant1Id_participant2Id: { participant1Id: p1, participant2Id: p2 } },
          select: { id: true },
        }),
        this.prisma.mentorshipProgram.findFirst({
          where: {
            OR: [
              { mentorId: userId, menteeId: recipientId },
              { mentorId: recipientId, menteeId: userId },
            ],
          },
          select: { id: true },
        }),
        this.prisma.mentorshipSession.findFirst({
          where: {
            OR: [
              { mentorId: userId, menteeId: recipientId },
              { mentorId: recipientId, menteeId: userId },
            ],
          },
          select: { id: true },
        }),
        this.prisma.mentorshipRequest.findFirst({
          where: {
            status: {
              in: [RequestStatus.PENDING, RequestStatus.ACCEPTED, RequestStatus.COMPLETED],
            },
            OR: [
              { mentorId: userId, menteeId: recipientId },
              { mentorId: recipientId, menteeId: userId },
            ],
          },
          select: { id: true },
        }),
      ]);

    if (!existingConv && !existingProgram && !existingSession && !existingRequest) {
      throw new ForbiddenException(
        'Vous devez disposer d’une relation ou demande de mentoring active pour écrire à cet utilisateur.',
      );
    }
  }

  private async getParticipantConversation(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participant1: { select: { id: true, nom: true, prenom: true, role: true } },
        participant2: { select: { id: true, nom: true, prenom: true, role: true } },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation introuvable.');
    }

    if (
      conversation.participant1Id !== userId &&
      conversation.participant2Id !== userId
    ) {
      throw new ForbiddenException('Vous ne participez pas à cette conversation.');
    }

    return conversation;
  }

  async listConversations(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        OR: [{ participant1Id: userId }, { participant2Id: userId }],
      },
      include: {
        participant1: { select: { id: true, nom: true, prenom: true, role: true } },
        participant2: { select: { id: true, nom: true, prenom: true, role: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { attachments: true },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    const unreadCounts = await this.prisma.message.groupBy({
      by: ['conversationId'],
      where: {
        conversationId: { in: conversations.map((c) => c.id) },
        senderId: { not: userId },
        isRead: false,
      },
      _count: { _all: true },
    });

    const unreadMap = new Map(
      unreadCounts.map((item) => [item.conversationId, item._count._all]),
    );

    return conversations.map((conv) => {
      const otherParticipant =
        conv.participant1Id === userId ? conv.participant2 : conv.participant1;

      return {
        id: conv.id,
        lastMessageAt: conv.lastMessageAt,
        createdAt: conv.createdAt,
        otherParticipant,
        lastMessage: conv.messages[0] || null,
        unreadCount: unreadMap.get(conv.id) ?? 0,
      };
    });
  }

  async startOrGetConversation(
    userId: string,
    userRole: UserRole,
    recipientId: string,
  ) {
    let targetUser = await this.prisma.user.findUnique({
      where: { id: recipientId },
      select: { id: true, role: true, nom: true, prenom: true },
    });

    if (!targetUser) {
      const mentorProfile = await this.prisma.mentorProfile.findUnique({
        where: { id: recipientId },
        select: {
          user: { select: { id: true, role: true, nom: true, prenom: true } },
        },
      });
      targetUser = mentorProfile?.user ?? null;
    }

    if (!targetUser) {
      throw new NotFoundException('Destinataire introuvable.');
    }

    await this.assertCanCommunicate(userId, userRole, targetUser.id, targetUser.role);

    const [participant1Id, participant2Id] = this.getOrderedParticipants(
      userId,
      targetUser.id,
    );

    return this.prisma.conversation.upsert({
      where: {
        participant1Id_participant2Id: { participant1Id, participant2Id },
      },
      create: { participant1Id, participant2Id },
      update: {},
      include: {
        participant1: { select: { id: true, nom: true, prenom: true, role: true } },
        participant2: { select: { id: true, nom: true, prenom: true, role: true } },
      },
    });
  }

  private detectAllowedAttachment(
    buffer: Buffer,
  ): { mimeType: string; ext: string } | null {
    if (
      buffer.length >= 5 &&
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46 &&
      buffer[4] === 0x2d
    ) {
      return { mimeType: 'application/pdf', ext: 'pdf' };
    }
    if (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    ) {
      return { mimeType: 'image/jpeg', ext: 'jpg' };
    }
    if (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return { mimeType: 'image/png', ext: 'png' };
    }
    if (
      buffer.length >= 12 &&
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) {
      return { mimeType: 'image/webp', ext: 'webp' };
    }
    return null;
  }

  private async refreshAttachmentUrls<
    T extends { attachments?: Array<{ fileUrl: string }> },
  >(conversationId: string, messages: T[]): Promise<T[]> {
    if (!this.supabaseService || messages.length === 0) {
      return messages;
    }

    const marker = `/storage/v1/object/sign/${ATTACHMENT_BUCKET}/`;
    const expectedPrefix = `messages/${conversationId}/`;

    return Promise.all(
      messages.map(async (msg) => {
        if (!msg.attachments?.length) {
          return msg;
        }

        const updatedAttachments = await Promise.all(
          msg.attachments.map(async (att) => {
            const markerIndex = att.fileUrl.indexOf(marker);
            if (markerIndex === -1) {
              return att;
            }
            const rawPath = decodeURIComponent(
              att.fileUrl.slice(markerIndex + marker.length).split('?')[0],
            );
            if (!rawPath.startsWith(expectedPrefix)) {
              return att;
            }
            const freshUrl = await this.supabaseService!.createSignedUrl(
              ATTACHMENT_BUCKET,
              rawPath,
              3600,
            );
            return freshUrl ? { ...att, fileUrl: freshUrl } : att;
          }),
        );

        return { ...msg, attachments: updatedAttachments };
      }),
    );
  }

  async uploadAttachment(
    userId: string,
    conversationId: string,
    dto: UploadAttachmentDto,
  ) {
    await this.getParticipantConversation(userId, conversationId);

    if (!this.supabaseService) {
      throw new InternalServerErrorException(
        'Le service de stockage des pièces jointes est indisponible.',
      );
    }

    const cleaned = dto.base64Data
      .replace(/^data:[^;]+;base64,/i, '')
      .trim();
    if (!cleaned) {
      throw new BadRequestException('Le fichier sélectionné est vide.');
    }

    const buffer = Buffer.from(cleaned, 'base64');
    if (buffer.length === 0) {
      throw new BadRequestException('Le fichier sélectionné est vide.');
    }
    if (buffer.length > MAX_ATTACHMENT_BYTES) {
      throw new BadRequestException('La pièce jointe ne doit pas dépasser 5 Mo.');
    }

    const detected = this.detectAllowedAttachment(buffer);
    if (!detected) {
      throw new BadRequestException(
        'Formats acceptés : PDF, JPG, PNG ou WEBP.',
      );
    }

    const storagePath = `messages/${conversationId}/${randomUUID()}.${detected.ext}`;
    await this.supabaseService.uploadPrivateFile(
      ATTACHMENT_BUCKET,
      storagePath,
      buffer,
      detected.mimeType,
    );

    const signedUrl = await this.supabaseService.createSignedUrl(
      ATTACHMENT_BUCKET,
      storagePath,
      7 * 24 * 3600,
    );

    if (!signedUrl) {
      await this.supabaseService.removeFile(ATTACHMENT_BUCKET, storagePath);
      throw new InternalServerErrorException(
        'Impossible de générer le lien sécurisé de la pièce jointe.',
      );
    }

    return {
      fileName: dto.fileName.trim(),
      fileUrl: signedUrl,
      fileSize: buffer.length,
      mimeType: detected.mimeType,
    };
  }

  async getMessages(userId: string, conversationId: string, query: ListMessagesDto) {
    await this.getParticipantConversation(userId, conversationId);

    const page = query.page || 1;
    const limit = query.limit || 30;
    const skip = (page - 1) * limit;

    const [total, rawData] = await Promise.all([
      this.prisma.message.count({ where: { conversationId } }),
      this.prisma.message.findMany({
        where: { conversationId },
        include: {
          sender: { select: { id: true, nom: true, prenom: true } },
          attachments: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const data = await this.refreshAttachmentUrls(conversationId, rawData);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async sendMessage(userId: string, conversationId: string, dto: SendMessageDto) {
    const conversation = await this.getParticipantConversation(userId, conversationId);
    const recipient =
      conversation.participant1Id === userId
        ? conversation.participant2
        : conversation.participant1;

    const sender =
      conversation.participant1Id === userId
        ? conversation.participant1
        : conversation.participant2;

    const now = new Date();
    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          conversationId,
          senderId: userId,
          content: dto.content,
          ...(dto.attachments && dto.attachments.length > 0
            ? {
                attachments: {
                  create: dto.attachments.map((att) => ({
                    fileName: att.fileName,
                    fileUrl: att.fileUrl,
                    fileSize: att.fileSize,
                    mimeType: att.mimeType,
                  })),
                },
              }
            : {}),
        },
        include: {
          sender: { select: { id: true, nom: true, prenom: true } },
          attachments: true,
        },
      });

      await tx.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: now },
      });

      return created;
    });

    this.emitNotification({
      userId: recipient.id,
      type: NotificationType.MESSAGE,
      titre: `Nouveau message de ${sender.prenom} ${sender.nom}`,
      message: dto.content.slice(0, 140),
      data: { conversationId, messageId: message.id },
    });

    return message;
  }

  async markConversationAsRead(userId: string, conversationId: string) {
    await this.getParticipantConversation(userId, conversationId);

    const result = await this.prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return {
      message: 'Messages marqués comme lus.',
      updatedCount: result.count,
    };
  }
}
