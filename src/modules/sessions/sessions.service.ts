import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../core/database/prisma.service.js';
import {
  AccountStatus,
  NotificationType,
  SessionStatus,
  UserRole,
  type Prisma,
} from '../../generated/prisma/client.js';
import {
  NOTIFICATION_CREATE_EVENT,
  type CreateNotificationEvent,
} from '../notifications/notifications.service.js';
import type { CreateSlotDto } from './dto/create-slot.dto.js';
import type { UpdateSlotDto } from './dto/update-slot.dto.js';
import type { BookSessionDto } from './dto/book-session.dto.js';
import type { RescheduleSessionDto } from './dto/reschedule-session.dto.js';
import type { CompleteSessionDto } from './dto/complete-session.dto.js';
import type { SessionFeedbackDto } from './dto/session-feedback.dto.js';
import type { ListSessionsDto } from './dto/list-sessions.dto.js';

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private emitNotification(payload: CreateNotificationEvent): void {
    this.eventEmitter.emit(NOTIFICATION_CREATE_EVENT, payload);
  }

  private assertValidTimeWindow(startTime: string, endTime: string) {
    if (startTime >= endTime) {
      throw new BadRequestException(
        'L’heure de fin (endTime) doit être postérieure à l’heure de début (startTime).',
      );
    }
  }

  private assertValidDateRange(start: Date, end: Date) {
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Dates de session invalides.');
    }
    if (start >= end) {
      throw new BadRequestException(
        'La date de fin (dateFin) doit être postérieure à la date de début (dateDebut).',
      );
    }
  }

  private async resolveMentorUserId(mentorIdOrProfileId: string): Promise<string> {
    const profile = await this.prisma.mentorProfile.findFirst({
      where: {
        OR: [{ userId: mentorIdOrProfileId }, { id: mentorIdOrProfileId }],
      },
      select: { userId: true, statutValidation: true },
    });

    if (profile) {
      return profile.userId;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: mentorIdOrProfileId },
      select: { id: true, role: true },
    });

    if (!user) {
      throw new NotFoundException('Mentor ou expert introuvable.');
    }

    return user.id;
  }

  private async assertNoMentorOverlap(
    mentorId: string,
    dateDebut: Date,
    dateFin: Date,
    excludeSessionId?: string,
  ) {
    const conflict = await this.prisma.mentorshipSession.findFirst({
      where: {
        mentorId,
        status: { in: [SessionStatus.SCHEDULED, SessionStatus.RESCHEDULED] },
        dateDebut: { lt: dateFin },
        dateFin: { gt: dateDebut },
        ...(excludeSessionId ? { id: { not: excludeSessionId } } : {}),
      },
      select: { id: true, dateDebut: true, dateFin: true },
    });

    if (conflict) {
      throw new ConflictException(
        'Le mentor possède déjà une session programmée sur ce créneau horaire.',
      );
    }
  }

  // ==========================================
  // DISPONIBILITÉS (SLOTS)
  // ==========================================

  async createSlot(mentorId: string, dto: CreateSlotDto) {
    this.assertValidTimeWindow(dto.startTime, dto.endTime);

    const isRecurring = dto.isRecurring ?? true;
    if (isRecurring && dto.dayOfWeek === undefined) {
      throw new BadRequestException(
        'dayOfWeek est obligatoire pour un créneau récurrent.',
      );
    }
    if (!isRecurring && !dto.specificDate) {
      throw new BadRequestException(
        'specificDate est obligatoire pour un créneau ponctuel.',
      );
    }

    return this.prisma.availabilitySlot.create({
      data: {
        mentorId,
        dayOfWeek: dto.dayOfWeek ?? null,
        startTime: dto.startTime,
        endTime: dto.endTime,
        specificDate: dto.specificDate ? new Date(dto.specificDate) : null,
        isRecurring,
      },
    });
  }

  async getMySlots(mentorId: string) {
    return this.prisma.availabilitySlot.findMany({
      where: { mentorId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async getMentorSlots(mentorIdOrProfileId: string) {
    const mentorUserId = await this.resolveMentorUserId(mentorIdOrProfileId);
    return this.prisma.availabilitySlot.findMany({
      where: {
        mentorId: mentorUserId,
        isActive: true,
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async updateSlot(
    userId: string,
    userRole: UserRole,
    slotId: string,
    dto: UpdateSlotDto,
  ) {
    const slot = await this.prisma.availabilitySlot.findUnique({
      where: { id: slotId },
    });

    if (!slot) {
      throw new NotFoundException('Créneau introuvable.');
    }

    if (slot.mentorId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Vous ne pouvez modifier que vos propres créneaux.');
    }

    const nextStart = dto.startTime ?? slot.startTime;
    const nextEnd = dto.endTime ?? slot.endTime;
    this.assertValidTimeWindow(nextStart, nextEnd);

    return this.prisma.availabilitySlot.update({
      where: { id: slotId },
      data: {
        ...(dto.dayOfWeek !== undefined ? { dayOfWeek: dto.dayOfWeek } : {}),
        ...(dto.startTime !== undefined ? { startTime: dto.startTime } : {}),
        ...(dto.endTime !== undefined ? { endTime: dto.endTime } : {}),
        ...(dto.specificDate !== undefined
          ? { specificDate: new Date(dto.specificDate) }
          : {}),
        ...(dto.isRecurring !== undefined ? { isRecurring: dto.isRecurring } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async deleteSlot(userId: string, userRole: UserRole, slotId: string) {
    const slot = await this.prisma.availabilitySlot.findUnique({
      where: { id: slotId },
    });

    if (!slot) {
      throw new NotFoundException('Créneau introuvable.');
    }

    if (slot.mentorId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Vous ne pouvez supprimer que vos propres créneaux.');
    }

    await this.prisma.availabilitySlot.delete({ where: { id: slotId } });
    return { message: 'Créneau supprimé.' };
  }

  // ==========================================
  // RÉSERVATION & GESTION DES SESSIONS (F09)
  // ==========================================

  async bookSession(userId: string, userRole: UserRole, dto: BookSessionDto) {
    const dateDebut = new Date(dto.dateDebut);
    const dateFin = new Date(dto.dateFin);
    this.assertValidDateRange(dateDebut, dateFin);

    let mentorId: string | undefined;
    let menteeId: string | undefined;

    if (dto.programId) {
      const program = await this.prisma.mentorshipProgram.findUnique({
        where: { id: dto.programId },
      });
      if (!program) {
        throw new NotFoundException('Parcours de mentoring introuvable.');
      }
      if (
        program.mentorId !== userId &&
        program.menteeId !== userId &&
        userRole !== UserRole.ADMIN
      ) {
        throw new ForbiddenException('Vous ne participez pas à ce parcours.');
      }
      mentorId = program.mentorId;
      menteeId = program.menteeId;
    } else if (
      (userRole === UserRole.MENTOR || userRole === UserRole.EXPERT) &&
      dto.menteeId
    ) {
      mentorId = dto.mentorId ? await this.resolveMentorUserId(dto.mentorId) : userId;
      menteeId = dto.menteeId;
    } else if (dto.mentorId) {
      mentorId = await this.resolveMentorUserId(dto.mentorId);
      menteeId = userRole === UserRole.ADMIN && dto.menteeId ? dto.menteeId : userId;
    }

    if (!mentorId || !menteeId) {
      throw new BadRequestException(
        'Veuillez fournir programId, mentorId (côté bénéficiaire) ou menteeId (côté mentor).',
      );
    }

    if (mentorId === menteeId) {
      throw new BadRequestException(
        'Un utilisateur ne peut pas réserver une session avec lui-même.',
      );
    }

    // Vérifier que le mentor existe et n'est pas bloqué
    const mentorProfile = await this.prisma.mentorProfile.findUnique({
      where: { userId: mentorId },
      select: { statutValidation: true },
    });
    if (
      mentorProfile &&
      mentorProfile.statutValidation !== AccountStatus.ACTIVE &&
      userRole !== UserRole.ADMIN
    ) {
      throw new BadRequestException('Ce mentor n’est pas validé pour des sessions.');
    }

    let slot: { id: string; mentorId: string; isActive: boolean; isRecurring: boolean } | null =
      null;
    if (dto.slotId) {
      slot = await this.prisma.availabilitySlot.findUnique({
        where: { id: dto.slotId },
        select: { id: true, mentorId: true, isActive: true, isRecurring: true },
      });
      if (!slot || slot.mentorId !== mentorId) {
        throw new NotFoundException('Créneau introuvable pour ce mentor.');
      }
      if (!slot.isActive) {
        throw new ConflictException('Ce créneau est déjà réservé ou inactif.');
      }
    }

    await this.assertNoMentorOverlap(mentorId, dateDebut, dateFin);

    const session = await this.prisma.$transaction(async (tx) => {
      const created = await tx.mentorshipSession.create({
        data: {
          programId: dto.programId ?? null,
          slotId: dto.slotId ?? null,
          mentorId,
          menteeId,
          titre: dto.titre,
          dateDebut,
          dateFin,
          meetingUrl: dto.meetingUrl ?? null,
          notes: dto.notes ?? null,
          status: SessionStatus.SCHEDULED,
        },
        include: {
          mentor: { select: { id: true, nom: true, prenom: true } },
          mentee: { select: { id: true, nom: true, prenom: true } },
        },
      });

      if (slot && !slot.isRecurring) {
        await tx.availabilitySlot.update({
          where: { id: slot.id },
          data: { isActive: false },
        });
      }

      return created;
    });

    const formattedDate = dateDebut.toISOString();
    this.emitNotification({
      userId: mentorId,
      type: NotificationType.RENDEZ_VOUS,
      titre: 'Nouvelle session planifiée',
      message: `Session "${dto.titre}" confirmée avec ${session.mentee.prenom} ${session.mentee.nom} (${formattedDate}).`,
      data: { sessionId: session.id },
    });
    this.emitNotification({
      userId: menteeId,
      type: NotificationType.RENDEZ_VOUS,
      titre: 'Session confirmée',
      message: `Votre session "${dto.titre}" avec ${session.mentor.prenom} ${session.mentor.nom} est confirmée (${formattedDate}).`,
      data: { sessionId: session.id },
    });

    return session;
  }

  async listSessions(userId: string, query: ListSessionsDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.MentorshipSessionWhereInput = {
      OR: [{ mentorId: userId }, { menteeId: userId }],
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.upcomingOnly) {
      where.dateDebut = { gte: new Date() };
    }

    const [total, data] = await Promise.all([
      this.prisma.mentorshipSession.count({ where }),
      this.prisma.mentorshipSession.findMany({
        where,
        include: {
          mentor: { select: { id: true, nom: true, prenom: true } },
          mentee: { select: { id: true, nom: true, prenom: true } },
          program: { select: { id: true, titre: true } },
        },
        orderBy: { dateDebut: 'asc' },
        skip,
        take: limit,
      }),
    ]);

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

  private async getAuthorizedSession(
    userId: string,
    userRole: UserRole,
    sessionId: string,
  ) {
    const session = await this.prisma.mentorshipSession.findUnique({
      where: { id: sessionId },
      include: {
        mentor: { select: { id: true, nom: true, prenom: true } },
        mentee: { select: { id: true, nom: true, prenom: true } },
        program: { select: { id: true, titre: true } },
        slot: true,
      },
    });

    if (!session) {
      throw new NotFoundException('Session introuvable.');
    }

    if (
      session.mentorId !== userId &&
      session.menteeId !== userId &&
      userRole !== UserRole.ADMIN
    ) {
      throw new ForbiddenException('Vous n’avez pas accès à cette session.');
    }

    return session;
  }

  async getSessionById(userId: string, userRole: UserRole, sessionId: string) {
    return this.getAuthorizedSession(userId, userRole, sessionId);
  }

  async rescheduleSession(
    userId: string,
    userRole: UserRole,
    sessionId: string,
    dto: RescheduleSessionDto,
  ) {
    const session = await this.getAuthorizedSession(userId, userRole, sessionId);

    if (
      session.status === SessionStatus.CANCELLED ||
      session.status === SessionStatus.COMPLETED
    ) {
      throw new BadRequestException(
        'Une session annulée ou terminée ne peut plus être reportée.',
      );
    }

    const dateDebut = new Date(dto.dateDebut);
    const dateFin = new Date(dto.dateFin);
    this.assertValidDateRange(dateDebut, dateFin);
    await this.assertNoMentorOverlap(session.mentorId, dateDebut, dateFin, sessionId);

    const updated = await this.prisma.mentorshipSession.update({
      where: { id: sessionId },
      data: {
        dateDebut,
        dateFin,
        status: SessionStatus.RESCHEDULED,
        ...(dto.meetingUrl !== undefined ? { meetingUrl: dto.meetingUrl } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });

    const otherParticipant =
      userId === session.mentorId ? session.menteeId : session.mentorId;
    this.emitNotification({
      userId: otherParticipant,
      type: NotificationType.RENDEZ_VOUS,
      titre: 'Session reportée',
      message: `La session "${session.titre}" a été reprogrammée au ${dateDebut.toISOString()}.`,
      data: { sessionId },
    });

    return updated;
  }

  async cancelSession(userId: string, userRole: UserRole, sessionId: string) {
    const session = await this.getAuthorizedSession(userId, userRole, sessionId);

    if (session.status === SessionStatus.COMPLETED) {
      throw new BadRequestException('Une session déjà terminée ne peut pas être annulée.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const cancelled = await tx.mentorshipSession.update({
        where: { id: sessionId },
        data: { status: SessionStatus.CANCELLED },
      });

      if (session.slot && !session.slot.isRecurring) {
        await tx.availabilitySlot.update({
          where: { id: session.slot.id },
          data: { isActive: true },
        });
      }

      return cancelled;
    });

    const otherParticipant =
      userId === session.mentorId ? session.menteeId : session.mentorId;
    this.emitNotification({
      userId: otherParticipant,
      type: NotificationType.RENDEZ_VOUS,
      titre: 'Session annulée',
      message: `La session "${session.titre}" a été annulée.`,
      data: { sessionId },
    });

    return updated;
  }

  async completeSession(
    userId: string,
    userRole: UserRole,
    sessionId: string,
    dto: CompleteSessionDto,
  ) {
    const session = await this.getAuthorizedSession(userId, userRole, sessionId);

    if (session.mentorId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Seul le mentor ou un administrateur peut clôturer la session.',
      );
    }

    if (session.status === SessionStatus.CANCELLED) {
      throw new BadRequestException(
        'Une session annulée ne peut pas être marquée comme terminée.',
      );
    }

    return this.prisma.mentorshipSession.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.COMPLETED,
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });
  }

  async submitFeedback(
    userId: string,
    userRole: UserRole,
    sessionId: string,
    dto: SessionFeedbackDto,
  ) {
    const session = await this.getAuthorizedSession(userId, userRole, sessionId);

    if (dto.feedback === undefined && dto.rating === undefined) {
      throw new BadRequestException(
        'Veuillez renseigner un commentaire (feedback) ou une note (rating).',
      );
    }

    const data: Prisma.MentorshipSessionUpdateInput = {};
    if (userId === session.mentorId && dto.feedback !== undefined) {
      data.feedbackMentor = dto.feedback;
    } else if (userId === session.menteeId && dto.feedback !== undefined) {
      data.feedbackMentee = dto.feedback;
    }

    if (dto.rating !== undefined) {
      data.rating = dto.rating;
    }

    return this.prisma.mentorshipSession.update({
      where: { id: sessionId },
      data,
    });
  }

  /**
   * Tâche planifiée (F09 / F15) : rappelle les sessions prévues dans les prochaines 24h
   */
  @Cron(CronExpression.EVERY_HOUR)
  async sendUpcomingSessionReminders(): Promise<number> {
    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const upcomingSessions = await this.prisma.mentorshipSession.findMany({
      where: {
        status: { in: [SessionStatus.SCHEDULED, SessionStatus.RESCHEDULED] },
        dateDebut: { gte: now, lte: in24Hours },
      },
      include: {
        mentor: { select: { id: true, nom: true, prenom: true } },
        mentee: { select: { id: true, nom: true, prenom: true } },
      },
    });

    if (upcomingSessions.length === 0) {
      return 0;
    }

    const recentReminders = await this.prisma.notification.findMany({
      where: {
        type: NotificationType.ECHEANCE,
        createdAt: { gte: fortyEightHoursAgo },
      },
      select: { userId: true, data: true },
    });

    const sentKeys = new Set<string>();
    for (const notif of recentReminders) {
      const payload = notif.data as Record<string, unknown> | null;
      const sessionId =
        payload && typeof payload.sessionId === 'string' ? payload.sessionId : null;
      if (sessionId) {
        sentKeys.add(`${notif.userId}:${sessionId}`);
      }
    }

    let emittedCount = 0;
    for (const session of upcomingSessions) {
      const dateStr = session.dateDebut.toISOString();

      if (!sentKeys.has(`${session.mentorId}:${session.id}`)) {
        this.emitNotification({
          userId: session.mentorId,
          type: NotificationType.ECHEANCE,
          titre: 'Rappel de session à venir',
          message: `Votre session "${session.titre}" avec ${session.mentee.prenom} ${session.mentee.nom} est prévue dans moins de 24h (${dateStr}).`,
          data: { sessionId: session.id, reminder: '24h' },
        });
        sentKeys.add(`${session.mentorId}:${session.id}`);
        emittedCount++;
      }

      if (!sentKeys.has(`${session.menteeId}:${session.id}`)) {
        this.emitNotification({
          userId: session.menteeId,
          type: NotificationType.ECHEANCE,
          titre: 'Rappel de session à venir',
          message: `Votre session "${session.titre}" avec ${session.mentor.prenom} ${session.mentor.nom} est prévue dans moins de 24h (${dateStr}).`,
          data: { sessionId: session.id, reminder: '24h' },
        });
        sentKeys.add(`${session.menteeId}:${session.id}`);
        emittedCount++;
      }
    }

    if (emittedCount > 0) {
      this.logger.log(
        `Rappels de sessions émis (F09/F15) : ${emittedCount} notification(s).`,
      );
    }

    return emittedCount;
  }
}
