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
  ProgramStatus,
  RequestStatus,
  TaskStatus,
  UserRole,
  type Prisma,
} from '../../generated/prisma/client.js';
import {
  NOTIFICATION_CREATE_EVENT,
  type CreateNotificationEvent,
} from '../notifications/notifications.service.js';
import type { CreateMentorshipRequestDto } from './dto/create-mentorship-request.dto.js';
import type { RespondMentorshipRequestDto } from './dto/respond-mentorship-request.dto.js';
import type { ListRequestsDto } from './dto/list-requests.dto.js';
import type { ListProgramsDto } from './dto/list-programs.dto.js';
import type { UpdateProgramDto } from './dto/update-program.dto.js';
import type { CreateGoalDto } from './dto/create-goal.dto.js';
import type { UpdateGoalDto } from './dto/update-goal.dto.js';
import type { CreateTaskDto } from './dto/create-task.dto.js';
import type { UpdateTaskDto } from './dto/update-task.dto.js';
import type { CreateResourceDto } from './dto/create-resource.dto.js';

@Injectable()
export class MentoringService {
  private readonly logger = new Logger(MentoringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private emitNotification(payload: CreateNotificationEvent): void {
    this.eventEmitter.emit(NOTIFICATION_CREATE_EVENT, payload);
  }

  private async getAuthorizedProgram(
    userId: string,
    userRole: UserRole,
    programId: string,
    mode: 'participant' | 'mentor',
  ) {
    const program = await this.prisma.mentorshipProgram.findUnique({
      where: { id: programId },
    });

    if (!program) {
      throw new NotFoundException('Parcours de mentoring introuvable.');
    }

    const isAdmin = userRole === UserRole.ADMIN;
    const isMentor = program.mentorId === userId;
    const isMentee = program.menteeId === userId;

    if (mode === 'mentor' && !isMentor && !isAdmin) {
      throw new ForbiddenException(
        'Seul le mentor référent ou un administrateur peut modifier cet élément.',
      );
    }

    if (mode === 'participant' && !isMentor && !isMentee && !isAdmin) {
      throw new ForbiddenException('Vous n’avez pas accès à ce parcours de mentoring.');
    }

    return program;
  }

  async recalculateProgramProgression(programId: string): Promise<number> {
    const [tasks, goals] = await Promise.all([
      this.prisma.mentorshipTask.findMany({
        where: { programId },
        select: { status: true },
      }),
      this.prisma.mentorshipGoal.findMany({
        where: { programId },
        select: { isCompleted: true },
      }),
    ]);

    let progression = 0;
    if (tasks.length > 0) {
      const done = tasks.filter((t) => t.status === TaskStatus.COMPLETED).length;
      progression = Math.round((done / tasks.length) * 1000) / 10;
    } else if (goals.length > 0) {
      const done = goals.filter((g) => g.isCompleted).length;
      progression = Math.round((done / goals.length) * 1000) / 10;
    }

    await this.prisma.mentorshipProgram.update({
      where: { id: programId },
      data: { progression },
    });

    return progression;
  }

  // ==========================================
  // F07 — DEMANDES DE MENTORING
  // ==========================================

  async createRequest(menteeId: string, dto: CreateMentorshipRequestDto) {
    const mentorProfile = await this.prisma.mentorProfile.findFirst({
      where: {
        OR: [{ userId: dto.mentorId }, { id: dto.mentorId }],
      },
      include: {
        user: {
          select: { id: true, nom: true, prenom: true, statutCompte: true },
        },
      },
    });

    if (!mentorProfile) {
      throw new NotFoundException('Mentor introuvable.');
    }

    if (
      mentorProfile.statutValidation !== AccountStatus.ACTIVE ||
      !mentorProfile.isAvailable
    ) {
      throw new BadRequestException(
        'Ce mentor n’est pas disponible pour recevoir de nouvelles demandes.',
      );
    }

    const targetMentorUserId = mentorProfile.userId;
    if (targetMentorUserId === menteeId) {
      throw new BadRequestException(
        'Vous ne pouvez pas vous envoyer une demande de mentoring à vous-même.',
      );
    }

    const existingPending = await this.prisma.mentorshipRequest.findFirst({
      where: {
        menteeId,
        mentorId: targetMentorUserId,
        status: RequestStatus.PENDING,
      },
    });

    if (existingPending) {
      throw new ConflictException(
        'Une demande en attente existe déjà auprès de ce mentor.',
      );
    }

    const request = await this.prisma.mentorshipRequest.create({
      data: {
        mentorId: targetMentorUserId,
        menteeId,
        objectif: dto.objectif,
        problematique: dto.problematique,
        duree: dto.duree,
        frequence: dto.frequence,
        format: dto.format,
        message: dto.message,
      },
      include: {
        mentor: { select: { id: true, nom: true, prenom: true, email: true } },
        mentee: { select: { id: true, nom: true, prenom: true, email: true } },
      },
    });

    this.emitNotification({
      userId: targetMentorUserId,
      type: NotificationType.DEMANDE,
      titre: 'Nouvelle demande de mentoring',
      message: `${request.mentee.prenom} ${request.mentee.nom} souhaite bénéficier de votre accompagnement : "${dto.objectif}".`,
      data: { requestId: request.id, menteeId },
    });

    return request;
  }

  async listRequests(userId: string, query: ListRequestsDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.MentorshipRequestWhereInput = {};
    if (query.direction === 'sent') {
      where.menteeId = userId;
    } else if (query.direction === 'received') {
      where.mentorId = userId;
    } else {
      where.OR = [{ menteeId: userId }, { mentorId: userId }];
    }

    if (query.status) {
      where.status = query.status;
    }

    const [total, data] = await Promise.all([
      this.prisma.mentorshipRequest.count({ where }),
      this.prisma.mentorshipRequest.findMany({
        where,
        include: {
          mentor: { select: { id: true, nom: true, prenom: true } },
          mentee: { select: { id: true, nom: true, prenom: true } },
          program: { select: { id: true, titre: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
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

  async getRequestById(userId: string, userRole: UserRole, requestId: string) {
    const request = await this.prisma.mentorshipRequest.findUnique({
      where: { id: requestId },
      include: {
        mentor: { select: { id: true, nom: true, prenom: true, pays: true } },
        mentee: { select: { id: true, nom: true, prenom: true, pays: true } },
        program: true,
      },
    });

    if (!request) {
      throw new NotFoundException('Demande de mentoring introuvable.');
    }

    if (
      request.mentorId !== userId &&
      request.menteeId !== userId &&
      userRole !== UserRole.ADMIN
    ) {
      throw new ForbiddenException('Accès refusé à cette demande de mentoring.');
    }

    return request;
  }

  async respondToRequest(
    userId: string,
    userRole: UserRole,
    requestId: string,
    dto: RespondMentorshipRequestDto,
  ) {
    const request = await this.prisma.mentorshipRequest.findUnique({
      where: { id: requestId },
      include: {
        mentor: { select: { id: true, nom: true, prenom: true } },
        program: true,
      },
    });

    if (!request) {
      throw new NotFoundException('Demande de mentoring introuvable.');
    }

    if (request.mentorId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Seul le mentor destinataire ou un administrateur peut répondre à cette demande.',
      );
    }

    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException(
        'Seule une demande en attente peut recevoir une réponse.',
      );
    }

    if (dto.action === 'ACCEPT') {
      const result = await this.prisma.$transaction(async (tx) => {
        const updatedRequest = await tx.mentorshipRequest.update({
          where: { id: requestId },
          data: {
            status: RequestStatus.ACCEPTED,
            responseMessage: dto.responseMessage ?? null,
            respondedAt: new Date(),
          },
        });

        const program =
          request.program ||
          (await tx.mentorshipProgram.create({
            data: {
              requestId: request.id,
              mentorId: request.mentorId,
              menteeId: request.menteeId,
              titre: dto.programTitle || `Parcours : ${request.objectif}`,
              description: dto.programDescription || request.problematique,
              status: ProgramStatus.ACTIVE,
            },
          }));

        return { request: updatedRequest, program };
      });

      this.emitNotification({
        userId: request.menteeId,
        type: NotificationType.ACCEPTATION,
        titre: 'Demande de mentoring acceptée',
        message: `${request.mentor.prenom} ${request.mentor.nom} a accepté votre demande et ouvert un parcours d’accompagnement.`,
        data: { requestId, programId: result.program.id },
      });

      return result;
    }

    if (dto.action === 'REJECT') {
      const updated = await this.prisma.mentorshipRequest.update({
        where: { id: requestId },
        data: {
          status: RequestStatus.REJECTED,
          responseMessage: dto.responseMessage ?? null,
          respondedAt: new Date(),
        },
      });

      this.emitNotification({
        userId: request.menteeId,
        type: NotificationType.DEMANDE,
        titre: 'Réponse à votre demande de mentoring',
        message: `${request.mentor.prenom} ${request.mentor.nom} n’a pas pu accepter votre demande pour le moment.`,
        data: { requestId },
      });

      return { request: updated };
    }

    // Action CLARIFY : la demande reste PENDING avec un message demandant des précisions
    const updated = await this.prisma.mentorshipRequest.update({
      where: { id: requestId },
      data: {
        responseMessage: dto.responseMessage ?? null,
        respondedAt: new Date(),
      },
    });

    this.emitNotification({
      userId: request.menteeId,
      type: NotificationType.DEMANDE,
      titre: 'Précisions demandées par le mentor',
      message: `${request.mentor.prenom} ${request.mentor.nom} demande des précisions sur votre besoin d’accompagnement.`,
      data: { requestId },
    });

    return { request: updated };
  }

  async cancelRequest(userId: string, userRole: UserRole, requestId: string) {
    const request = await this.prisma.mentorshipRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Demande de mentoring introuvable.');
    }

    if (request.menteeId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Seul le bénéficiaire demandeur ou un administrateur peut annuler cette demande.',
      );
    }

    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException('Seule une demande en attente peut être annulée.');
    }

    return this.prisma.mentorshipRequest.update({
      where: { id: requestId },
      data: { status: RequestStatus.CANCELLED },
    });
  }

  // ==========================================
  // F08 — PARCOURS, OBJECTIFS, TÂCHES, RESSOURCES
  // ==========================================

  async listPrograms(userId: string, query: ListProgramsDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.MentorshipProgramWhereInput = {};
    if (query.role === 'mentor') {
      where.mentorId = userId;
    } else if (query.role === 'mentee') {
      where.menteeId = userId;
    } else {
      where.OR = [{ mentorId: userId }, { menteeId: userId }];
    }

    if (query.status) {
      where.status = query.status;
    }

    const [total, data] = await Promise.all([
      this.prisma.mentorshipProgram.count({ where }),
      this.prisma.mentorshipProgram.findMany({
        where,
        include: {
          mentor: { select: { id: true, nom: true, prenom: true } },
          mentee: { select: { id: true, nom: true, prenom: true } },
          _count: {
            select: { goals: true, tasks: true, resources: true, sessions: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
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

  async getProgramById(userId: string, userRole: UserRole, programId: string) {
    await this.getAuthorizedProgram(userId, userRole, programId, 'participant');

    return this.prisma.mentorshipProgram.findUnique({
      where: { id: programId },
      include: {
        mentor: { select: { id: true, nom: true, prenom: true, pays: true } },
        mentee: { select: { id: true, nom: true, prenom: true, pays: true } },
        goals: { orderBy: { createdAt: 'asc' } },
        tasks: { orderBy: { createdAt: 'asc' } },
        resources: { orderBy: { createdAt: 'desc' } },
        sessions: { orderBy: { dateDebut: 'desc' } },
      },
    });
  }

  async updateProgram(
    userId: string,
    userRole: UserRole,
    programId: string,
    dto: UpdateProgramDto,
  ) {
    const program = await this.getAuthorizedProgram(
      userId,
      userRole,
      programId,
      'mentor',
    );

    const updated = await this.prisma.mentorshipProgram.update({
      where: { id: programId },
      data: {
        ...(dto.titre !== undefined ? { titre: dto.titre } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.endDate !== undefined ? { endDate: new Date(dto.endDate) } : {}),
      },
    });

    if (dto.status === ProgramStatus.COMPLETED && program.requestId) {
      await this.prisma.mentorshipRequest.update({
        where: { id: program.requestId },
        data: { status: RequestStatus.COMPLETED },
      });
    }

    return updated;
  }

  async addGoal(
    userId: string,
    userRole: UserRole,
    programId: string,
    dto: CreateGoalDto,
  ) {
    await this.getAuthorizedProgram(userId, userRole, programId, 'mentor');

    const goal = await this.prisma.mentorshipGoal.create({
      data: {
        programId,
        titre: dto.titre,
        description: dto.description,
        indicateurs: dto.indicateurs,
        echeance: dto.echeance ? new Date(dto.echeance) : undefined,
      },
    });

    const progression = await this.recalculateProgramProgression(programId);
    return { goal, progression };
  }

  async updateGoal(
    userId: string,
    userRole: UserRole,
    programId: string,
    goalId: string,
    dto: UpdateGoalDto,
  ) {
    await this.getAuthorizedProgram(userId, userRole, programId, 'mentor');

    const existing = await this.prisma.mentorshipGoal.findFirst({
      where: { id: goalId, programId },
    });
    if (!existing) {
      throw new NotFoundException('Objectif introuvable dans ce parcours.');
    }

    const goal = await this.prisma.mentorshipGoal.update({
      where: { id: goalId },
      data: {
        ...(dto.titre !== undefined ? { titre: dto.titre } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.indicateurs !== undefined ? { indicateurs: dto.indicateurs } : {}),
        ...(dto.echeance !== undefined ? { echeance: new Date(dto.echeance) } : {}),
        ...(dto.isCompleted !== undefined ? { isCompleted: dto.isCompleted } : {}),
      },
    });

    const progression = await this.recalculateProgramProgression(programId);
    return { goal, progression };
  }

  async deleteGoal(
    userId: string,
    userRole: UserRole,
    programId: string,
    goalId: string,
  ) {
    await this.getAuthorizedProgram(userId, userRole, programId, 'mentor');

    const existing = await this.prisma.mentorshipGoal.findFirst({
      where: { id: goalId, programId },
    });
    if (!existing) {
      throw new NotFoundException('Objectif introuvable dans ce parcours.');
    }

    await this.prisma.mentorshipGoal.delete({ where: { id: goalId } });
    const progression = await this.recalculateProgramProgression(programId);
    return { message: 'Objectif supprimé.', progression };
  }

  private async ensureGoalInProgram(programId: string, goalId?: string) {
    if (!goalId) {
      return;
    }
    const goal = await this.prisma.mentorshipGoal.findFirst({
      where: { id: goalId, programId },
      select: { id: true },
    });
    if (!goal) {
      throw new BadRequestException(
        'Le sous-objectif spécifié n’appartient pas à ce parcours.',
      );
    }
  }

  async addTask(
    userId: string,
    userRole: UserRole,
    programId: string,
    dto: CreateTaskDto,
  ) {
    await this.getAuthorizedProgram(userId, userRole, programId, 'mentor');
    await this.ensureGoalInProgram(programId, dto.goalId);

    const task = await this.prisma.mentorshipTask.create({
      data: {
        programId,
        goalId: dto.goalId,
        titre: dto.titre,
        description: dto.description,
        echeance: dto.echeance ? new Date(dto.echeance) : undefined,
      },
    });

    const progression = await this.recalculateProgramProgression(programId);
    return { task, progression };
  }

  async updateTask(
    userId: string,
    userRole: UserRole,
    programId: string,
    taskId: string,
    dto: UpdateTaskDto,
  ) {
    await this.getAuthorizedProgram(userId, userRole, programId, 'participant');

    const existing = await this.prisma.mentorshipTask.findFirst({
      where: { id: taskId, programId },
    });
    if (!existing) {
      throw new NotFoundException('Tâche introuvable dans ce parcours.');
    }

    await this.ensureGoalInProgram(programId, dto.goalId);

    const task = await this.prisma.mentorshipTask.update({
      where: { id: taskId },
      data: {
        ...(dto.titre !== undefined ? { titre: dto.titre } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.goalId !== undefined ? { goalId: dto.goalId } : {}),
        ...(dto.echeance !== undefined ? { echeance: new Date(dto.echeance) } : {}),
        ...(dto.status !== undefined
          ? {
              status: dto.status,
              completedAt: dto.status === TaskStatus.COMPLETED ? new Date() : null,
            }
          : {}),
      },
    });

    const progression = await this.recalculateProgramProgression(programId);
    return { task, progression };
  }

  async deleteTask(
    userId: string,
    userRole: UserRole,
    programId: string,
    taskId: string,
  ) {
    await this.getAuthorizedProgram(userId, userRole, programId, 'mentor');

    const existing = await this.prisma.mentorshipTask.findFirst({
      where: { id: taskId, programId },
    });
    if (!existing) {
      throw new NotFoundException('Tâche introuvable dans ce parcours.');
    }

    await this.prisma.mentorshipTask.delete({ where: { id: taskId } });
    const progression = await this.recalculateProgramProgression(programId);
    return { message: 'Tâche supprimée.', progression };
  }

  async addResource(
    userId: string,
    userRole: UserRole,
    programId: string,
    dto: CreateResourceDto,
  ) {
    await this.getAuthorizedProgram(userId, userRole, programId, 'mentor');

    return this.prisma.mentorshipResource.create({
      data: {
        programId,
        titre: dto.titre,
        type: dto.type,
        url: dto.url,
      },
    });
  }

  async deleteResource(
    userId: string,
    userRole: UserRole,
    programId: string,
    resourceId: string,
  ) {
    await this.getAuthorizedProgram(userId, userRole, programId, 'mentor');

    const existing = await this.prisma.mentorshipResource.findFirst({
      where: { id: resourceId, programId },
    });
    if (!existing) {
      throw new NotFoundException('Ressource introuvable dans ce parcours.');
    }

    await this.prisma.mentorshipResource.delete({ where: { id: resourceId } });
    return { message: 'Ressource supprimée.' };
  }

  /**
   * Tâche planifiée (F08 / F15) : rappelle les tâches arrivant à échéance dans les prochaines 24h
   */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async sendUpcomingTaskDeadlineReminders(): Promise<number> {
    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const tasksDueSoon = await this.prisma.mentorshipTask.findMany({
      where: {
        status: { not: TaskStatus.COMPLETED },
        echeance: { gte: now, lte: in24Hours },
        program: { status: ProgramStatus.ACTIVE },
      },
      include: {
        program: { select: { id: true, titre: true, menteeId: true } },
      },
    });

    if (tasksDueSoon.length === 0) {
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
      const taskId =
        payload && typeof payload.taskId === 'string' ? payload.taskId : null;
      if (taskId) {
        sentKeys.add(`${notif.userId}:${taskId}`);
      }
    }

    let emittedCount = 0;
    for (const task of tasksDueSoon) {
      const key = `${task.program.menteeId}:${task.id}`;
      if (sentKeys.has(key)) {
        continue;
      }

      const deadlineStr = task.echeance ? task.echeance.toISOString() : '';
      this.emitNotification({
        userId: task.program.menteeId,
        type: NotificationType.ECHEANCE,
        titre: `Échéance proche : ${task.titre}`,
        message: `L’action "${task.titre}" du parcours "${task.program.titre}" arrive à échéance (${deadlineStr}).`,
        data: { taskId: task.id, programId: task.program.id },
      });
      sentKeys.add(key);
      emittedCount++;
    }

    if (emittedCount > 0) {
      this.logger.log(
        `Rappels d’échéances de tâches émis (F08/F15) : ${emittedCount} notification(s).`,
      );
    }

    return emittedCount;
  }
}
