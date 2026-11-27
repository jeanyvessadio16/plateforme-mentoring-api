import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../core/database/prisma.service.js';
import {
  AccountStatus,
  NotificationType,
  OpportunityStatus,
  UserRole,
  type Prisma,
} from '../../generated/prisma/client.js';
import type { CreateOpportunityDto } from './dto/create-opportunity.dto.js';
import type { UpdateOpportunityDto } from './dto/update-opportunity.dto.js';
import type { FilterOpportunitiesDto } from './dto/filter-opportunities.dto.js';

@Injectable()
export class OpportunitiesService {
  private readonly logger = new Logger(OpportunitiesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(filter: FilterOpportunitiesDto) {
    const page = filter.page || 1;
    const limit = filter.limit || 12;
    const skip = (page - 1) * limit;

    const where: Prisma.OpportunityWhereInput = {};
    const targetStatus = filter.status ?? OpportunityStatus.ACTIVE;
    where.status = targetStatus;
    if (targetStatus === OpportunityStatus.ACTIVE) {
      where.dateExpiration = { gte: new Date() };
    }

    if (filter.categorie) {
      where.categorie = filter.categorie;
    }
    if (filter.localisation) {
      where.localisation = { contains: filter.localisation, mode: 'insensitive' };
    }
    if (filter.typeContrat) {
      where.typeContrat = { contains: filter.typeContrat, mode: 'insensitive' };
    }
    if (filter.search) {
      where.OR = [
        { titre: { contains: filter.search, mode: 'insensitive' } },
        { organisation: { contains: filter.search, mode: 'insensitive' } },
        { description: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    const [total, data] = await Promise.all([
      this.prisma.opportunity.count({ where }),
      this.prisma.opportunity.findMany({
        where,
        orderBy: [{ dateExpiration: 'asc' }, { createdAt: 'desc' }],
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

  async findById(id: string) {
    const opportunity = await this.prisma.opportunity.findUnique({
      where: { id },
    });

    if (!opportunity) {
      throw new NotFoundException('Opportunité introuvable.');
    }

    return opportunity;
  }

  async getMyFavorites(userId: string) {
    return this.prisma.opportunityFavorite.findMany({
      where: { userId },
      include: { opportunity: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findManaged(userId: string, userRole: UserRole) {
    const where: Prisma.OpportunityWhereInput =
      userRole === UserRole.ADMIN ? {} : { createdById: userId };

    const data = await this.prisma.opportunity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return { data };
  }

  private assertCanManageOpportunity(
    opportunity: { createdById?: string | null },
    actor?: { id: string; role: UserRole },
  ): void {
    if (!actor || actor.role === UserRole.ADMIN) {
      return;
    }
    if (!opportunity.createdById || opportunity.createdById !== actor.id) {
      throw new ForbiddenException(
        'Vous ne pouvez modifier ou supprimer que les opportunités publiées par votre organisation.',
      );
    }
  }

  async addFavorite(opportunityId: string, userId: string) {
    await this.findById(opportunityId);

    return this.prisma.opportunityFavorite.upsert({
      where: {
        opportunityId_userId: { opportunityId, userId },
      },
      create: { opportunityId, userId },
      update: {},
    });
  }

  async removeFavorite(opportunityId: string, userId: string) {
    const existing = await this.prisma.opportunityFavorite.findUnique({
      where: {
        opportunityId_userId: { opportunityId, userId },
      },
    });

    if (!existing) {
      throw new NotFoundException('Cette opportunité ne figure pas dans vos favoris.');
    }

    await this.prisma.opportunityFavorite.delete({
      where: {
        opportunityId_userId: { opportunityId, userId },
      },
    });

    return { message: 'Opportunité retirée des favoris.' };
  }

  async create(dto: CreateOpportunityDto, createdById?: string) {
    const created = await this.prisma.opportunity.create({
      data: {
        createdById: createdById ?? null,
        titre: dto.titre,
        organisation: dto.organisation,
        categorie: dto.categorie,
        description: dto.description,
        localisation: dto.localisation ?? null,
        typeContrat: dto.typeContrat ?? null,
        lienCandidature: dto.lienCandidature,
        dateExpiration: new Date(dto.dateExpiration),
        status: OpportunityStatus.ACTIVE,
      },
    });

    if (this.prisma.user?.findMany && this.prisma.notification?.createMany) {
      try {
        const beneficiaries = await this.prisma.user.findMany({
          where: {
            role: UserRole.BENEFICIAIRE,
            statutCompte: AccountStatus.ACTIVE,
          },
          select: { id: true },
          take: 1000,
        });

        if (beneficiaries.length > 0) {
          await this.prisma.notification.createMany({
            data: beneficiaries.map((b) => ({
              userId: b.id,
              type: NotificationType.OPPORTUNITE,
              titre: `Nouvelle opportunité : ${created.titre}`,
              message: `${created.organisation} — ${created.categorie}`,
              data: { opportunityId: created.id },
            })),
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Échec non bloquant lors de la notification d’opportunité (${created.id}): ${message}`,
        );
      }
    }

    return created;
  }

  async update(
    id: string,
    dto: UpdateOpportunityDto,
    actor?: { id: string; role: UserRole },
  ) {
    const existing = await this.findById(id);
    this.assertCanManageOpportunity(existing, actor);

    return this.prisma.opportunity.update({
      where: { id },
      data: {
        ...(dto.titre !== undefined ? { titre: dto.titre } : {}),
        ...(dto.organisation !== undefined ? { organisation: dto.organisation } : {}),
        ...(dto.categorie !== undefined ? { categorie: dto.categorie } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.localisation !== undefined ? { localisation: dto.localisation } : {}),
        ...(dto.typeContrat !== undefined ? { typeContrat: dto.typeContrat } : {}),
        ...(dto.lienCandidature !== undefined
          ? { lienCandidature: dto.lienCandidature }
          : {}),
        ...(dto.dateExpiration !== undefined
          ? { dateExpiration: new Date(dto.dateExpiration) }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });
  }

  async remove(id: string, actor?: { id: string; role: UserRole }) {
    const existing = await this.findById(id);
    this.assertCanManageOpportunity(existing, actor);
    await this.prisma.opportunity.delete({ where: { id } });
    return { message: 'Opportunité supprimée.' };
  }

  /**
   * Tâche planifiée (F12) : archive automatiquement les opportunités expirées
   */
  @Cron(CronExpression.EVERY_HOUR)
  async archiveExpiredOpportunities(): Promise<number> {
    const result = await this.prisma.opportunity.updateMany({
      where: {
        status: OpportunityStatus.ACTIVE,
        dateExpiration: { lt: new Date() },
      },
      data: {
        status: OpportunityStatus.EXPIRED,
      },
    });

    if (result.count > 0) {
      this.logger.log(
        `Archivage automatique : ${result.count} opportunité(s) expirée(s) passée(s) au statut EXPIRED.`,
      );
    }

    return result.count;
  }
}
