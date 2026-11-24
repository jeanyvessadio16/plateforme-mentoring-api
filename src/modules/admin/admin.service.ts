import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { stringify } from 'csv-stringify/sync';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../../core/database/prisma.service.js';
import { SupabaseService } from '../../core/supabase/supabase.service.js';
import {
  AccountStatus,
  MilieuResidence,
  NotificationType,
  OpportunityCategory,
  OpportunityStatus,
  ProgramStatus,
  ReportStatus,
  RequestStatus,
  SessionStatus,
  Sexe,
  UserRole,
  type Prisma,
} from '../../generated/prisma/client.js';
import {
  NOTIFICATION_CREATE_EVENT,
  type CreateNotificationEvent,
} from '../notifications/notifications.service.js';
import type { ListAdminUsersDto } from './dto/list-admin-users.dto.js';
import type { UpdateUserStatusDto } from './dto/update-user-status.dto.js';
import type { UpdateMatchingWeightsDto } from './dto/update-matching-weights.dto.js';
import type { CreateReportDto } from './dto/create-report.dto.js';
import type { UpdateReportDto } from './dto/update-report.dto.js';
import type { ListReportsDto } from './dto/list-reports.dto.js';

const CV_STORAGE_BUCKET = 'mentor-documents';

function metaString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  let str: string;
  if (typeof value === 'string') {
    str = value;
  } else if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    str = String(value);
  } else if (value instanceof Date) {
    str = value.toISOString();
  } else {
    str = JSON.stringify(value);
  }
  if (/^[\t\r ]*[=+\-@]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabaseService: SupabaseService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private emitNotification(payload: CreateNotificationEvent): void {
    this.eventEmitter.emit(NOTIFICATION_CREATE_EVENT, payload);
  }

  // ==========================================
  // F16 & F17 — STATISTIQUES & KPIs D'IMPACT
  // ==========================================

  async getStats() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const now = new Date();

    const [
      users,
      completedProfilesCount,
      activeMentorsCount,
      pendingValidationsCount,
      totalMatchesCount,
      totalRequestsCount,
      pendingRequestsCount,
      activeProgramsCount,
      completedProgramsCount,
      totalSessionsCount,
      completedSessionsCount,
      ratingAggregate,
      masterclassesCount,
      masterclassRegistrationsCount,
      totalOpportunitiesCount,
      activeOpportunitiesCount,
      employmentStageOpportunitiesCount,
      pendingReportsCount,
    ] = await Promise.all([
      this.prisma.user.findMany({
        select: {
          role: true,
          statutCompte: true,
          sexe: true,
          milieuResidence: true,
          situationHandicap: true,
          pays: true,
          age: true,
          createdAt: true,
        },
      }),
      this.prisma.userProfile.count({
        where: {
          secteurActivite: { not: null },
          niveauEtude: { not: null },
        },
      }),
      this.prisma.mentorProfile.count({
        where: { statutValidation: AccountStatus.ACTIVE, isAvailable: true },
      }),
      this.prisma.user.count({
        where: {
          OR: [
            { statutCompte: AccountStatus.PENDING },
            { mentorProfile: { is: { statutValidation: AccountStatus.PENDING } } },
          ],
        },
      }),
      this.prisma.matchingResult.count(),
      this.prisma.mentorshipRequest.count(),
      this.prisma.mentorshipRequest.count({ where: { status: RequestStatus.PENDING } }),
      this.prisma.mentorshipProgram.count({ where: { status: ProgramStatus.ACTIVE } }),
      this.prisma.mentorshipProgram.count({ where: { status: ProgramStatus.COMPLETED } }),
      this.prisma.mentorshipSession.count(),
      this.prisma.mentorshipSession.count({ where: { status: SessionStatus.COMPLETED } }),
      this.prisma.mentorshipSession.aggregate({
        _avg: { rating: true },
        where: { rating: { not: null } },
      }),
      this.prisma.masterclass.count(),
      this.prisma.masterclassRegistration.count(),
      this.prisma.opportunity.count(),
      this.prisma.opportunity.count({
        where: { status: OpportunityStatus.ACTIVE, dateExpiration: { gte: now } },
      }),
      this.prisma.opportunity.count({
        where: {
          categorie: { in: [OpportunityCategory.EMPLOI, OpportunityCategory.STAGE] },
        },
      }),
      this.prisma.report.count({ where: { status: ReportStatus.PENDING } }),
    ]);

    const byRole: Record<string, number> = {};
    const bySexe: Record<string, number> = {};
    const byMilieuResidence: Record<string, number> = {};
    const byCountry: Record<string, number> = {};
    const byAgeGroup: Record<string, number> = {
      '15-24': 0,
      '25-34': 0,
      '35-44': 0,
      '45+': 0,
      nonRenseigne: 0,
    };

    let activeUsers = 0;
    let newUsersLast30Days = 0;
    let sdhCount = 0;

    for (const u of users) {
      byRole[u.role] = (byRole[u.role] || 0) + 1;
      if (u.statutCompte === AccountStatus.ACTIVE) {
        activeUsers++;
      }
      if (u.createdAt >= thirtyDaysAgo) {
        newUsersLast30Days++;
      }
      if (u.sexe) {
        bySexe[u.sexe] = (bySexe[u.sexe] || 0) + 1;
      }
      if (u.milieuResidence) {
        byMilieuResidence[u.milieuResidence] =
          (byMilieuResidence[u.milieuResidence] || 0) + 1;
      }
      if (u.situationHandicap) {
        sdhCount++;
      }
      if (u.pays) {
        byCountry[u.pays] = (byCountry[u.pays] || 0) + 1;
      }
      if (u.age === null) {
        byAgeGroup.nonRenseigne++;
      } else if (u.age <= 24) {
        byAgeGroup['15-24']++;
      } else if (u.age <= 34) {
        byAgeGroup['25-34']++;
      } else if (u.age <= 44) {
        byAgeGroup['35-44']++;
      } else {
        byAgeGroup['45+']++;
      }
    }

    const totalFinishedOrActivePrograms = activeProgramsCount + completedProgramsCount;
    const programCompletionRate =
      totalFinishedOrActivePrograms > 0
        ? Math.round((completedProgramsCount / totalFinishedOrActivePrograms) * 1000) / 10
        : 0;

    const usersWithGender = users.filter((u) => u.sexe !== null);
    const femalesCount = bySexe[Sexe.FEMME] || 0;
    const malesCount = bySexe[Sexe.HOMME] || 0;
    const femalePercentage =
      usersWithGender.length > 0
        ? Math.round((femalesCount / usersWithGender.length) * 100)
        : 0;
    const malePercentage =
      usersWithGender.length > 0
        ? Math.round((malesCount / usersWithGender.length) * 100)
        : 0;

    const usersWithResidence = users.filter((u) => u.milieuResidence !== null);
    const ruralCount = byMilieuResidence[MilieuResidence.RURAL] || 0;
    const urbanCount = byMilieuResidence[MilieuResidence.URBAIN] || 0;
    const ruralPercentage =
      usersWithResidence.length > 0
        ? Math.round((ruralCount / usersWithResidence.length) * 100)
        : 0;
    const urbanPercentage =
      usersWithResidence.length > 0
        ? Math.round((urbanCount / usersWithResidence.length) * 100)
        : 0;

    const sdhPercentage =
      users.length > 0 ? Math.round((sdhCount / users.length) * 100) : 0;

    const usersWithAge = users.filter((u) => typeof u.age === 'number' && u.age > 0);
    const averageAge =
      usersWithAge.length > 0
        ? Math.round(
            usersWithAge.reduce((acc, u) => acc + (u.age ?? 0), 0) /
              usersWithAge.length,
          )
        : 0;

    const satisfactionRate = ratingAggregate._avg.rating
      ? Math.round((ratingAggregate._avg.rating / 5) * 100)
      : 0;

    return {
      kpis: {
        totalUsers: users.length,
        activeUsers,
        newUsersLast30Days,
        completedProfilesCount,
        activeMentorsCount,
        pendingValidationsCount,
        totalMatchesCount,
        totalRequestsCount,
        pendingRequestsCount,
        activeProgramsCount,
        completedProgramsCount,
        programCompletionRate,
        totalSessionsCount,
        completedSessionsCount,
        averageSatisfactionRating: ratingAggregate._avg.rating
          ? Math.round(ratingAggregate._avg.rating * 100) / 100
          : null,
        satisfactionRate,
        masterclassesCount,
        masterclassRegistrationsCount,
        totalOpportunitiesCount,
        activeOpportunitiesCount,
        employmentStageOpportunitiesCount,
        pendingReportsCount,
      },
      demographics: {
        byRole,
        bySexe,
        byMilieuResidence,
        sdhCount,
        byCountry,
        byAgeGroup,
        femalePercentage,
        malePercentage,
        ruralPercentage,
        urbanPercentage,
        sdhPercentage,
        averageAge,
      },
    };
  }

  // ==========================================
  // F16 — VALIDATION MENTORS & GESTION COMPTES
  // ==========================================

  async getPendingValidations() {
    const candidates = await this.prisma.user.findMany({
      where: {
        OR: [
          { statutCompte: AccountStatus.PENDING },
          { mentorProfile: { is: { statutValidation: AccountStatus.PENDING } } },
        ],
      },
      include: {
        mentorProfile: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(
      candidates.map(async (u) => {
        let signedCvUrl: string | null = null;
        const rawCv = u.mentorProfile?.cvUrl;
        if (rawCv) {
          if (rawCv.startsWith('https://') || rawCv.startsWith('http://')) {
            signedCvUrl = rawCv;
          } else {
            signedCvUrl = await this.supabaseService.createSignedUrl(
              CV_STORAGE_BUCKET,
              rawCv,
              3600,
            );
          }
        }

        return {
          id: u.id,
          email: u.email,
          nom: u.nom,
          prenom: u.prenom,
          role: u.role,
          statutCompte: u.statutCompte,
          pays: u.pays,
          createdAt: u.createdAt,
          mentorProfile: u.mentorProfile
            ? {
                ...u.mentorProfile,
                signedCvUrl,
              }
            : null,
        };
      }),
    );
  }

  async listUsers(filter: ListAdminUsersDto) {
    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};
    if (filter.role) {
      where.role = filter.role;
    }
    if (filter.status) {
      where.statutCompte = filter.status;
    }
    if (filter.search) {
      where.OR = [
        { nom: { contains: filter.search, mode: 'insensitive' } },
        { prenom: { contains: filter.search, mode: 'insensitive' } },
        { email: { contains: filter.search, mode: 'insensitive' } },
        { pays: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    const [total, data] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: {
          profile: { select: { ville: true, secteurActivite: true, photoUrl: true } },
          mentorProfile: {
            select: {
              id: true,
              fonction: true,
              organisation: true,
              statutValidation: true,
              isAvailable: true,
            },
          },
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

  async updateUserStatus(adminId: string, userId: string, dto: UpdateUserStatusDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { mentorProfile: true },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    const isActive = dto.status === AccountStatus.ACTIVE;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        statutCompte: dto.status,
        ...(user.mentorProfile
          ? {
              mentorProfile: {
                update: {
                  statutValidation: dto.status,
                  isAvailable: isActive,
                  verifiedAt: isActive ? new Date() : null,
                  verifiedBy: isActive ? adminId : null,
                },
              },
            }
          : {}),
      },
      include: { mentorProfile: true },
    });

    if (user.supabaseUid) {
      try {
        const adminClient = this.supabaseService.getAdminClient();
        await adminClient.auth.admin.updateUserById(user.supabaseUid, {
          user_metadata: {
            status: dto.status,
            statutCompte: dto.status,
          },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Échec non bloquant de synchronisation metadata Supabase (${user.supabaseUid}): ${msg}`,
        );
      }
    }

    this.emitNotification({
      userId: user.id,
      type: NotificationType.SYSTEM,
      titre: 'Mise à jour de votre statut de compte',
      message: dto.reason
        ? `Statut du compte mis à jour (${dto.status}) : ${dto.reason}`
        : `Le statut de votre compte est désormais : ${dto.status}.`,
      data: { status: dto.status },
    });

    return updated;
  }

  async updateUserRole(userId: string, role: UserRole) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { role },
    });

    if (user.supabaseUid) {
      try {
        const adminClient = this.supabaseService.getAdminClient();
        await adminClient.auth.admin.updateUserById(user.supabaseUid, {
          user_metadata: { role },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Échec non bloquant de synchronisation rôle Supabase (${user.supabaseUid}): ${msg}`,
        );
      }
    }

    return updated;
  }

  async syncAuthUsers() {
    const adminClient = this.supabaseService.getAdminClient();
    const existingUsers = await this.prisma.user.findMany({
      select: { supabaseUid: true, email: true },
    });

    const existingUids = new Set(existingUsers.map((u) => u.supabaseUid));
    const existingEmails = new Set(existingUsers.map((u) => u.email.toLowerCase()));

    let page = 1;
    const perPage = 200;
    let syncedCount = 0;

    while (true) {
      const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
      if (error || !data?.users?.length) {
        break;
      }

      for (const authUser of data.users) {
        if (!authUser.email) {
          continue;
        }
        const normalizedEmail = authUser.email.toLowerCase();
        if (existingUids.has(authUser.id) || existingEmails.has(normalizedEmail)) {
          continue;
        }

        const meta = (authUser.user_metadata || {}) as Record<string, unknown>;
        const rawRole = metaString(
          meta.role,
          metaString(meta.account_type, 'BENEFICIAIRE'),
        ).toUpperCase();
        const role =
          rawRole === 'MENTOR' ||
          rawRole === 'EXPERT' ||
          rawRole === 'PARTENAIRE' ||
          rawRole === 'ADMIN'
            ? (rawRole as UserRole)
            : UserRole.BENEFICIAIRE;

        const rawSexe = metaString(meta.sexe).toUpperCase();
        const sexe =
          rawSexe === 'HOMME' ? Sexe.HOMME : rawSexe === 'FEMME' ? Sexe.FEMME : null;

        const rawMilieu = metaString(meta.milieu_residence).toUpperCase();
        const milieuResidence =
          rawMilieu === 'RURAL'
            ? MilieuResidence.RURAL
            : rawMilieu === 'URBAIN'
            ? MilieuResidence.URBAIN
            : null;

        await this.prisma.user.create({
          data: {
            supabaseUid: authUser.id,
            email: authUser.email,
            nom: metaString(meta.last_name, metaString(meta.nom)),
            prenom: metaString(meta.first_name, metaString(meta.prenom)),
            telephone: typeof meta.phone === 'string' ? meta.phone : null,
            pays: metaString(meta.country),
            role,
            statutCompte:
              role === UserRole.BENEFICIAIRE || role === UserRole.ADMIN
                ? AccountStatus.ACTIVE
                : AccountStatus.PENDING,
            sexe,
            milieuResidence,
            situationHandicap: meta.sdh === 'Oui' || meta.sdh === true,
          },
        });

        existingUids.add(authUser.id);
        existingEmails.add(normalizedEmail);
        syncedCount++;
      }

      if (data.users.length < perPage) {
        break;
      }
      page++;
    }

    return {
      message: `${syncedCount} compte(s) synchronisé(s) depuis Supabase Auth.`,
      syncedCount,
    };
  }

  async listPrograms(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [total, data] = await Promise.all([
      this.prisma.mentorshipProgram.count(),
      this.prisma.mentorshipProgram.findMany({
        include: {
          mentor: { select: { id: true, nom: true, prenom: true, email: true } },
          mentee: { select: { id: true, nom: true, prenom: true, email: true } },
          _count: { select: { goals: true, tasks: true, sessions: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async listSessions(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [total, data] = await Promise.all([
      this.prisma.mentorshipSession.count(),
      this.prisma.mentorshipSession.findMany({
        include: {
          mentor: { select: { id: true, nom: true, prenom: true, email: true } },
          mentee: { select: { id: true, nom: true, prenom: true, email: true } },
        },
        orderBy: { dateDebut: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getRecentActivities() {
    const [recentUsers, recentRequests, recentReports] = await Promise.all([
      this.prisma.user.findMany({
        select: {
          id: true,
          nom: true,
          prenom: true,
          email: true,
          role: true,
          statutCompte: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.mentorshipRequest.findMany({
        select: {
          id: true,
          objectif: true,
          status: true,
          createdAt: true,
          mentee: { select: { nom: true, prenom: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.report.findMany({
        select: { id: true, targetType: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    return { recentUsers, recentRequests, recentReports };
  }

  // ==========================================
  // F05 / F16 — PONDÉRATIONS MATCHING
  // ==========================================

  async getMatchingWeights() {
    const config = await this.prisma.matchingWeightConfig.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    if (!config) {
      return {
        expertiseWeight: 0.3,
        objectiveWeight: 0.25,
        sectorWeight: 0.15,
        availabilityWeight: 0.1,
        languageWeight: 0.1,
        formatWeight: 0.1,
        isDefault: true,
      };
    }

    return config;
  }

  async updateMatchingWeights(adminId: string, dto: UpdateMatchingWeightsDto) {
    const total =
      dto.expertiseWeight +
      dto.objectiveWeight +
      dto.sectorWeight +
      dto.availabilityWeight +
      dto.languageWeight +
      dto.formatWeight;

    if (total < 0.99 || total > 1.01) {
      throw new BadRequestException(
        `La somme des pondérations doit être égale à 1.0 (actuellement ${total.toFixed(3)}).`,
      );
    }

    const existing = await this.prisma.matchingWeightConfig.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    const payload = {
      expertiseWeight: dto.expertiseWeight,
      objectiveWeight: dto.objectiveWeight,
      sectorWeight: dto.sectorWeight,
      availabilityWeight: dto.availabilityWeight,
      languageWeight: dto.languageWeight,
      formatWeight: dto.formatWeight,
      updatedBy: adminId,
    };

    if (existing) {
      return this.prisma.matchingWeightConfig.update({
        where: { id: existing.id },
        data: payload,
      });
    }

    return this.prisma.matchingWeightConfig.create({
      data: payload,
    });
  }

  // ==========================================
  // F16 — SIGNALEMENTS (REPORTS)
  // ==========================================

  async createReport(reporterId: string, dto: CreateReportDto) {
    if (dto.reportedUserId) {
      const targetUser = await this.prisma.user.findUnique({
        where: { id: dto.reportedUserId },
        select: { id: true },
      });
      if (!targetUser) {
        throw new NotFoundException('Utilisateur signalé introuvable.');
      }
    }

    return this.prisma.report.create({
      data: {
        reporterId,
        reportedUserId: dto.reportedUserId ?? null,
        targetType: dto.targetType,
        targetId: dto.targetId,
        motif: dto.motif,
      },
    });
  }

  async getMyReports(reporterId: string) {
    return this.prisma.report.findMany({
      where: { reporterId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listReports(filter: ListReportsDto) {
    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ReportWhereInput = {};
    if (filter.status) {
      where.status = filter.status;
    }

    const [total, data] = await Promise.all([
      this.prisma.report.count({ where }),
      this.prisma.report.findMany({
        where,
        include: {
          reporter: { select: { id: true, nom: true, prenom: true, email: true } },
          reportedUser: { select: { id: true, nom: true, prenom: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async updateReport(reportId: string, dto: UpdateReportDto) {
    const existing = await this.prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!existing) {
      throw new NotFoundException('Signalement introuvable.');
    }

    const isFinalStatus =
      dto.status === ReportStatus.RESOLVED || dto.status === ReportStatus.DISMISSED;

    return this.prisma.report.update({
      where: { id: reportId },
      data: {
        status: dto.status,
        ...(dto.adminNotes !== undefined ? { adminNotes: dto.adminNotes } : {}),
        resolvedAt: isFinalStatus ? new Date() : null,
      },
    });
  }

  // ==========================================
  // F17 — EXPORTS CSV, EXCEL & PDF
  // ==========================================

  async exportUsers(format: 'csv' | 'xlsx') {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        role: true,
        statutCompte: true,
        pays: true,
        age: true,
        sexe: true,
        milieuResidence: true,
        situationHandicap: true,
        createdAt: true,
      },
    });

    const rows = users.map((u) => ({
      id: sanitizeCsvCell(u.id),
      email: sanitizeCsvCell(u.email),
      nom: sanitizeCsvCell(u.nom),
      prenom: sanitizeCsvCell(u.prenom),
      role: sanitizeCsvCell(u.role),
      statutCompte: sanitizeCsvCell(u.statutCompte),
      pays: sanitizeCsvCell(u.pays),
      age: sanitizeCsvCell(u.age),
      sexe: sanitizeCsvCell(u.sexe),
      milieuResidence: sanitizeCsvCell(u.milieuResidence),
      situationHandicap: sanitizeCsvCell(u.situationHandicap ? 'Oui' : 'Non'),
      createdAt: sanitizeCsvCell(u.createdAt.toISOString()),
    }));

    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Utilisateurs');
      sheet.columns = [
        { header: 'ID', key: 'id', width: 38 },
        { header: 'Email', key: 'email', width: 28 },
        { header: 'Nom', key: 'nom', width: 20 },
        { header: 'Prénom', key: 'prenom', width: 20 },
        { header: 'Rôle', key: 'role', width: 16 },
        { header: 'Statut', key: 'statutCompte', width: 14 },
        { header: 'Pays', key: 'pays', width: 16 },
        { header: 'Âge', key: 'age', width: 8 },
        { header: 'Sexe', key: 'sexe', width: 10 },
        { header: 'Milieu', key: 'milieuResidence', width: 12 },
        { header: 'SDH', key: 'situationHandicap', width: 8 },
        { header: 'Date inscription', key: 'createdAt', width: 24 },
      ];
      sheet.addRows(rows);
      const arrayBuffer = await workbook.xlsx.writeBuffer();
      return {
        buffer: Buffer.from(arrayBuffer as ArrayBuffer),
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename: 'acceent-users-export.xlsx',
      };
    }

    const csvText = stringify(rows, { header: true });
    return {
      buffer: Buffer.from(`\uFEFF${csvText}`, 'utf-8'),
      contentType: 'text/csv; charset=utf-8',
      filename: 'acceent-users-export.csv',
    };
  }

  async exportImpactReport(format: 'csv' | 'xlsx' | 'pdf') {
    const stats = await this.getStats();
    const kpiRows = Object.entries(stats.kpis).map(([metric, value]) => ({
      indicateur: sanitizeCsvCell(metric),
      valeur: sanitizeCsvCell(value),
    }));

    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Impact KPIs');
      sheet.columns = [
        { header: 'Indicateur', key: 'indicateur', width: 36 },
        { header: 'Valeur', key: 'valeur', width: 20 },
      ];
      sheet.addRows(kpiRows);
      const arrayBuffer = await workbook.xlsx.writeBuffer();
      return {
        buffer: Buffer.from(arrayBuffer as ArrayBuffer),
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename: 'acceent-impact-report.xlsx',
      };
    }

    if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      const pdfPromise = new Promise<Buffer>((resolve, reject) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
      });

      doc.fontSize(18).text('ACCEENT Mentoring — Rapport d’Impact & KPIs', {
        align: 'left',
      });
      doc.moveDown(0.5);
      doc.fontSize(10).text(`Généré le : ${new Date().toISOString()}`);
      doc.moveDown(1);

      doc.fontSize(13).text('Indicateurs clés de performance (F17)');
      doc.moveDown(0.5);
      for (const row of kpiRows) {
        doc.fontSize(10).text(`${row.indicateur} : ${row.valeur}`);
      }

      doc.moveDown(1);
      doc.fontSize(13).text('Répartition démographique');
      doc.moveDown(0.5);
      doc.fontSize(10).text(`Rôles : ${JSON.stringify(stats.demographics.byRole)}`);
      doc.fontSize(10).text(`Sexe : ${JSON.stringify(stats.demographics.bySexe)}`);
      doc
        .fontSize(10)
        .text(`Milieu : ${JSON.stringify(stats.demographics.byMilieuResidence)}`);
      doc.fontSize(10).text(`Situation de handicap (SDH) : ${stats.demographics.sdhCount}`);

      doc.end();
      const buffer = await pdfPromise;
      return {
        buffer,
        contentType: 'application/pdf',
        filename: 'acceent-impact-report.pdf',
      };
    }

    const csvText = stringify(kpiRows, { header: true });
    return {
      buffer: Buffer.from(`\uFEFF${csvText}`, 'utf-8'),
      contentType: 'text/csv; charset=utf-8',
      filename: 'acceent-impact-report.csv',
    };
  }
}
