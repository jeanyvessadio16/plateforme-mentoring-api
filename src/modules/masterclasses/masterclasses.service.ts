import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../core/database/prisma.service.js';
import {
  AccountStatus,
  MasterclassStatus,
  NotificationType,
  UserRole,
  type Prisma,
} from '../../generated/prisma/client.js';
import {
  NOTIFICATION_CREATE_EVENT,
  type CreateNotificationEvent,
} from '../notifications/notifications.service.js';
import type { CreateMasterclassDto } from './dto/create-masterclass.dto.js';
import type { UpdateMasterclassDto } from './dto/update-masterclass.dto.js';
import type { FilterMasterclassesDto } from './dto/filter-masterclasses.dto.js';

@Injectable()
export class MasterclassesService {
  // Sélection publique excluant lienLive et lienReplay (protégés par inscription/authentification)
  private readonly PUBLIC_MASTERCLASS_SELECT = {
    id: true,
    titre: true,
    intervenant: true,
    description: true,
    categorie: true,
    dateSession: true,
    duree: true,
    statut: true,
    maxParticipants: true,
    createdAt: true,
    updatedAt: true,
    _count: {
      select: { registrations: true },
    },
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private emitNotification(payload: CreateNotificationEvent): void {
    this.eventEmitter.emit(NOTIFICATION_CREATE_EVENT, payload);
  }

  async findPublicMasterclasses(filter: FilterMasterclassesDto) {
    const page = filter.page || 1;
    const limit = filter.limit || 12;
    const skip = (page - 1) * limit;

    const where: Prisma.MasterclassWhereInput = {};
    if (filter.categorie) {
      where.categorie = { contains: filter.categorie, mode: 'insensitive' };
    }
    if (filter.statut) {
      where.statut = filter.statut;
    }
    if (filter.search) {
      where.OR = [
        { titre: { contains: filter.search, mode: 'insensitive' } },
        { intervenant: { contains: filter.search, mode: 'insensitive' } },
        { description: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    const [total, data] = await Promise.all([
      this.prisma.masterclass.count({ where }),
      this.prisma.masterclass.findMany({
        where,
        select: this.PUBLIC_MASTERCLASS_SELECT,
        orderBy: { dateSession: 'asc' },
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

  async getPublicMasterclassById(id: string) {
    const masterclass = await this.prisma.masterclass.findUnique({
      where: { id },
      select: this.PUBLIC_MASTERCLASS_SELECT,
    });

    if (!masterclass) {
      throw new NotFoundException('Masterclass introuvable.');
    }

    return masterclass;
  }

  async getAccessLinks(
    id: string,
    userId: string,
    userRole: UserRole,
    statutCompte: AccountStatus = AccountStatus.ACTIVE,
  ) {
    const masterclass = await this.prisma.masterclass.findUnique({
      where: { id },
      select: {
        id: true,
        titre: true,
        statut: true,
        lienLive: true,
        lienReplay: true,
      },
    });

    if (!masterclass) {
      throw new NotFoundException('Masterclass introuvable.');
    }

    const canBypassRegistration =
      userRole === UserRole.ADMIN ||
      (userRole === UserRole.EXPERT && statutCompte === AccountStatus.ACTIVE);

    if (!canBypassRegistration) {
      const registration = await this.prisma.masterclassRegistration.findUnique({
        where: {
          masterclassId_userId: { masterclassId: id, userId },
        },
      });
      if (!registration) {
        throw new ForbiddenException(
          'Vous devez être inscrit à cette masterclass pour accéder au lien live/replay.',
        );
      }
    }

    return masterclass;
  }

  async register(id: string, userId: string) {
    const masterclass = await this.prisma.masterclass.findUnique({
      where: { id },
      include: {
        _count: { select: { registrations: true } },
      },
    });

    if (!masterclass) {
      throw new NotFoundException('Masterclass introuvable.');
    }

    if (masterclass.statut === MasterclassStatus.CANCELLED) {
      throw new BadRequestException('Cette masterclass a été annulée.');
    }

    const existing = await this.prisma.masterclassRegistration.findUnique({
      where: {
        masterclassId_userId: { masterclassId: id, userId },
      },
    });

    if (existing) {
      throw new ConflictException('Vous êtes déjà inscrit à cette masterclass.');
    }

    if (
      masterclass.maxParticipants !== null &&
      masterclass._count.registrations >= masterclass.maxParticipants
    ) {
      throw new ConflictException('Cette masterclass a atteint sa capacité maximale.');
    }

    const registration = await this.prisma.masterclassRegistration.create({
      data: {
        masterclassId: id,
        userId,
      },
    });

    this.emitNotification({
      userId,
      type: NotificationType.MASTERCLASS,
      titre: 'Inscription confirmée',
      message: `Votre inscription à la masterclass "${masterclass.titre}" (${masterclass.dateSession.toISOString()}) est confirmée.`,
      data: { masterclassId: id },
    });

    return registration;
  }

  async unregister(id: string, userId: string) {
    const existing = await this.prisma.masterclassRegistration.findUnique({
      where: {
        masterclassId_userId: { masterclassId: id, userId },
      },
    });

    if (!existing) {
      throw new NotFoundException('Inscription introuvable pour cette masterclass.');
    }

    await this.prisma.masterclassRegistration.delete({
      where: {
        masterclassId_userId: { masterclassId: id, userId },
      },
    });

    return { message: 'Désinscription confirmée.' };
  }

  async getMyRegistrations(userId: string) {
    return this.prisma.masterclassRegistration.findMany({
      where: { userId },
      include: {
        masterclass: true,
      },
      orderBy: { registeredAt: 'desc' },
    });
  }

  async create(dto: CreateMasterclassDto) {
    return this.prisma.masterclass.create({
      data: {
        titre: dto.titre,
        intervenant: dto.intervenant,
        description: dto.description,
        categorie: dto.categorie,
        dateSession: new Date(dto.dateSession),
        duree: dto.duree,
        lienLive: dto.lienLive ?? null,
        lienReplay: dto.lienReplay ?? null,
        statut: dto.statut ?? MasterclassStatus.UPCOMING,
        maxParticipants: dto.maxParticipants ?? null,
      },
    });
  }

  async update(id: string, dto: UpdateMasterclassDto) {
    const existing = await this.prisma.masterclass.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Masterclass introuvable.');
    }

    return this.prisma.masterclass.update({
      where: { id },
      data: {
        ...(dto.titre !== undefined ? { titre: dto.titre } : {}),
        ...(dto.intervenant !== undefined ? { intervenant: dto.intervenant } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.categorie !== undefined ? { categorie: dto.categorie } : {}),
        ...(dto.dateSession !== undefined
          ? { dateSession: new Date(dto.dateSession) }
          : {}),
        ...(dto.duree !== undefined ? { duree: dto.duree } : {}),
        ...(dto.lienLive !== undefined ? { lienLive: dto.lienLive } : {}),
        ...(dto.lienReplay !== undefined ? { lienReplay: dto.lienReplay } : {}),
        ...(dto.statut !== undefined ? { statut: dto.statut } : {}),
        ...(dto.maxParticipants !== undefined
          ? { maxParticipants: dto.maxParticipants }
          : {}),
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.masterclass.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Masterclass introuvable.');
    }

    await this.prisma.masterclass.delete({ where: { id } });
    return { message: 'Masterclass supprimée.' };
  }

  async listRegistrations(masterclassId: string) {
    const existing = await this.prisma.masterclass.findUnique({
      where: { id: masterclassId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Masterclass introuvable.');
    }

    return this.prisma.masterclassRegistration.findMany({
      where: { masterclassId },
      include: {
        user: { select: { id: true, nom: true, prenom: true, email: true, role: true } },
      },
      orderBy: { registeredAt: 'asc' },
    });
  }

  async markAttendance(masterclassId: string, targetUserId: string, attended: boolean) {
    const existing = await this.prisma.masterclassRegistration.findUnique({
      where: {
        masterclassId_userId: { masterclassId, userId: targetUserId },
      },
    });

    if (!existing) {
      throw new NotFoundException('Inscription introuvable.');
    }

    return this.prisma.masterclassRegistration.update({
      where: {
        masterclassId_userId: { masterclassId, userId: targetUserId },
      },
      data: { attended },
    });
  }
}
