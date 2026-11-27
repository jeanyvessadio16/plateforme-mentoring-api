import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service.js';
import {
  AccountStatus,
  MasterclassStatus,
  MilieuResidence,
  OpportunityStatus,
  ProgramStatus,
  RequestStatus,
  SessionStatus,
  Sexe,
  TaskStatus,
  UserRole,
} from '../../generated/prisma/client.js';

@Injectable()
export class DashboardsService {
  constructor(private readonly prisma: PrismaService) {}

  private computeProfileCompletion(user: {
    nom: string | null;
    prenom: string | null;
    telephone: string | null;
    pays: string | null;
    age: number | null;
    profile?: {
      ville: string | null;
      niveauEtude: string | null;
      secteurActivite: string | null;
      competences: string[];
      objectifs: string[];
      disponibilite: string | null;
    } | null;
  }): number {
    const checks = [
      Boolean(user.prenom),
      Boolean(user.nom),
      Boolean(user.telephone),
      Boolean(user.pays),
      user.age !== null,
      Boolean(user.profile?.ville),
      Boolean(user.profile?.niveauEtude),
      Boolean(user.profile?.secteurActivite),
      Boolean(user.profile?.competences?.length),
      Boolean(user.profile?.objectifs?.length),
      Boolean(user.profile?.disponibilite),
    ];
    const completed = checks.filter(Boolean).length;
    return Math.round((completed / checks.length) * 100);
  }

  async getPublicStats() {
    const now = new Date();
    const [
      activeMentors,
      activeBeneficiaries,
      completedSessions,
      activeOpportunities,
      upcomingMasterclasses,
      totalMasterclasses,
    ] = await Promise.all([
      this.prisma.mentorProfile.count({
        where: { statutValidation: AccountStatus.ACTIVE, isAvailable: true },
      }),
      this.prisma.user.count({
        where: { role: UserRole.BENEFICIAIRE, statutCompte: AccountStatus.ACTIVE },
      }),
      this.prisma.mentorshipSession.count({
        where: { status: SessionStatus.COMPLETED },
      }),
      this.prisma.opportunity.count({
        where: { status: OpportunityStatus.ACTIVE, dateExpiration: { gte: now } },
      }),
      this.prisma.masterclass.count({
        where: { statut: MasterclassStatus.UPCOMING },
      }),
      this.prisma.masterclass.count(),
    ]);

    return {
      activeMentors,
      activeBeneficiaries,
      completedSessions,
      activeOpportunities,
      upcomingMasterclasses,
      totalMasterclasses,
    };
  }

  async getBeneficiaryDashboard(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        diagnostic: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    const now = new Date();
    const [
      activePrograms,
      upcomingSessions,
      completedSessionsCount,
      topRecommendations,
      recommendedOpportunities,
      upcomingMasterclasses,
      unreadNotificationsCount,
    ] = await Promise.all([
      this.prisma.mentorshipProgram.findMany({
        where: { menteeId: userId, status: ProgramStatus.ACTIVE },
        include: {
          mentor: {
            select: {
              id: true,
              nom: true,
              prenom: true,
              email: true,
              mentorProfile: { select: { fonction: true, organisation: true } },
            },
          },
          goals: { orderBy: { createdAt: 'asc' } },
          tasks: {
            where: { status: { not: TaskStatus.COMPLETED } },
            orderBy: { echeance: 'asc' },
          },
          resources: { orderBy: { createdAt: 'desc' }, take: 5 },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.mentorshipSession.findMany({
        where: {
          menteeId: userId,
          OR: [
            { status: SessionStatus.SCHEDULED },
            {
              status: SessionStatus.RESCHEDULED,
              dateDebut: { gte: now },
            },
            {
              dateDebut: { gte: now },
              status: { not: SessionStatus.CANCELLED },
            },
          ],
        },
        include: {
          mentor: { select: { id: true, nom: true, prenom: true } },
        },
        orderBy: { dateDebut: 'asc' },
      }),
      this.prisma.mentorshipSession.count({
        where: { menteeId: userId, status: SessionStatus.COMPLETED },
      }),
      this.prisma.matchingResult.findMany({
        where: {
          menteeId: userId,
          mentor: {
            statutValidation: AccountStatus.ACTIVE,
            isAvailable: true,
            user: {
              statutCompte: AccountStatus.ACTIVE,
            },
          },
        },
        select: {
          id: true,
          scoreTotal: true,
          justification: true,
          mentor: {
            select: {
              id: true,
              userId: true,
              fonction: true,
              organisation: true,
              anneesExperience: true,
              expertises: true,
              secteurs: true,
              isAvailable: true,
              photoUrl: true,
              user: { select: { id: true, nom: true, prenom: true, pays: true } },
            },
          },
        },
        orderBy: { scoreTotal: 'desc' },
        take: 5,
      }),
      this.prisma.opportunity.findMany({
        where: { status: OpportunityStatus.ACTIVE, dateExpiration: { gte: now } },
        orderBy: { dateExpiration: 'asc' },
        take: 5,
      }),
      this.prisma.masterclass.findMany({
        where: { statut: { in: [MasterclassStatus.UPCOMING, MasterclassStatus.LIVE] } },
        select: {
          id: true,
          titre: true,
          intervenant: true,
          categorie: true,
          dateSession: true,
          duree: true,
          statut: true,
          maxParticipants: true,
        },
        orderBy: { dateSession: 'asc' },
        take: 5,
      }),
      this.prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ]);

    const fallbackMentors =
      topRecommendations.length === 0
        ? await this.prisma.mentorProfile.findMany({
            where: {
              statutValidation: AccountStatus.ACTIVE,
              isAvailable: true,
              user: { statutCompte: AccountStatus.ACTIVE },
            },
            select: {
              id: true,
              userId: true,
              fonction: true,
              organisation: true,
              anneesExperience: true,
              expertises: true,
              secteurs: true,
              isAvailable: true,
              photoUrl: true,
              user: { select: { id: true, nom: true, prenom: true, pays: true } },
            },
            take: 4,
            orderBy: { anneesExperience: 'desc' },
          })
        : [];

    return {
      user: {
        id: user.id,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        pays: user.pays,
        role: user.role,
        age: user.age,
        sexe: user.sexe,
        milieuResidence: user.milieuResidence,
        situationHandicap: user.situationHandicap,
        statutCompte: user.statutCompte,
        photoUrl: user.profile?.photoUrl ?? null,
        profileCompletion: this.computeProfileCompletion(user),
      },
      diagnostic: user.diagnostic,
      activePrograms,
      nextSession: upcomingSessions[0] ?? null,
      upcomingSessions,
      completedSessionsCount,
      topRecommendations,
      fallbackMentors,
      recommendedOpportunities,
      upcomingMasterclasses,
      unreadNotificationsCount,
    };
  }

  async getMentorDashboard(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: { select: { photoUrl: true } },
        mentorProfile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    const now = new Date();
    const [
      requests,
      activePrograms,
      sessions,
      activeSlots,
      openTasksCount,
      unreadMessagesCount,
      unreadNotificationsCount,
    ] = await Promise.all([
      this.prisma.mentorshipRequest.findMany({
        where: { mentorId: userId },
        include: {
          mentee: {
            select: { id: true, nom: true, prenom: true, email: true, pays: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.mentorshipProgram.findMany({
        where: { mentorId: userId, status: ProgramStatus.ACTIVE },
        include: {
          mentee: { select: { id: true, nom: true, prenom: true, email: true } },
          _count: { select: { goals: true, tasks: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.mentorshipSession.findMany({
        where: { mentorId: userId },
        include: {
          mentee: { select: { id: true, nom: true, prenom: true } },
        },
        orderBy: { dateDebut: 'asc' },
      }),
      this.prisma.availabilitySlot.findMany({
        where: { mentorId: userId, isActive: true },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      }),
      this.prisma.mentorshipTask.count({
        where: {
          program: { mentorId: userId, status: ProgramStatus.ACTIVE },
          status: { not: TaskStatus.COMPLETED },
        },
      }),
      this.prisma.message.count({
        where: {
          conversation: {
            OR: [{ participant1Id: userId }, { participant2Id: userId }],
          },
          senderId: { not: userId },
          isRead: false,
        },
      }),
      this.prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ]);

    const pendingRequests = requests.filter((r) => r.status === RequestStatus.PENDING);
    const upcomingSessions = sessions.filter(
      (s) =>
        (s.status === SessionStatus.SCHEDULED ||
          s.status === SessionStatus.RESCHEDULED) &&
        s.dateDebut >= now,
    );
    const completedSessionsCount = sessions.filter(
      (s) => s.status === SessionStatus.COMPLETED,
    ).length;

    return {
      user: {
        id: user.id,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        role: user.role,
        statutCompte: user.statutCompte,
        photoUrl: user.profile?.photoUrl ?? null,
      },
      mentorProfile: user.mentorProfile,
      requests,
      pendingRequests,
      totalRequestsCount: requests.length,
      activePrograms,
      sessions,
      upcomingSessions,
      completedSessionsCount,
      activeSlots,
      openTasksCount,
      unreadMessagesCount,
      unreadNotificationsCount,
    };
  }

  async getExpertDashboard(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true, mentorProfile: true },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    const now = new Date();
    const [masterclasses, sessions, unreadNotificationsCount] = await Promise.all([
      this.prisma.masterclass.findMany({
        where: user.role === UserRole.ADMIN ? {} : { createdById: userId },
        orderBy: { dateSession: 'asc' },
        take: 20,
        include: { _count: { select: { registrations: true } } },
      }),
      this.prisma.mentorshipSession.findMany({
        where: { mentorId: userId },
        include: {
          mentee: { select: { id: true, nom: true, prenom: true } },
        },
        orderBy: { dateDebut: 'asc' },
      }),
      this.prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ]);

    const upcomingSessions = sessions.filter(
      (s) =>
        (s.status === SessionStatus.SCHEDULED ||
          s.status === SessionStatus.RESCHEDULED) &&
        s.dateDebut >= now,
    );
    const completedSessionsCount = sessions.filter(
      (s) => s.status === SessionStatus.COMPLETED,
    ).length;

    return {
      user: {
        id: user.id,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        role: user.role,
        statutCompte: user.statutCompte,
        photoUrl: user.profile?.photoUrl ?? null,
      },
      mentorProfile: user.mentorProfile,
      masterclasses,
      sessions,
      upcomingSessions,
      completedSessionsCount,
      unreadNotificationsCount,
    };
  }

  async getPartnerDashboard(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        role: true,
        statutCompte: true,
        profile: { select: { photoUrl: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    const [
      allOpportunities,
      allUsers,
      activeMentors,
      activePrograms,
      completedPrograms,
      completedSessions,
      ratingAggregate,
    ] = await Promise.all([
      this.prisma.opportunity.findMany({
        where: user.role === UserRole.ADMIN ? {} : { createdById: userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.findMany({
        select: {
          role: true,
          statutCompte: true,
          sexe: true,
          milieuResidence: true,
          situationHandicap: true,
          age: true,
        },
      }),
      this.prisma.mentorProfile.count({
        where: { statutValidation: AccountStatus.ACTIVE, isAvailable: true },
      }),
      this.prisma.mentorshipProgram.count({ where: { status: ProgramStatus.ACTIVE } }),
      this.prisma.mentorshipProgram.count({ where: { status: ProgramStatus.COMPLETED } }),
      this.prisma.mentorshipSession.count({ where: { status: SessionStatus.COMPLETED } }),
      this.prisma.mentorshipSession.aggregate({
        _avg: { rating: true },
        where: { rating: { not: null } },
      }),
    ]);

    const activeOpportunitiesCount = allOpportunities.filter(
      (o) => o.status === OpportunityStatus.ACTIVE,
    ).length;
    const expiredOpportunitiesCount = allOpportunities.filter(
      (o) => o.status === OpportunityStatus.EXPIRED,
    ).length;

    const totalUsers = allUsers.length;
    const totalBeneficiaries = allUsers.filter(
      (u) => u.role === UserRole.BENEFICIAIRE,
    ).length;
    const totalMentors = allUsers.filter((u) => u.role === UserRole.MENTOR).length;
    const totalPartners = allUsers.filter(
      (u) => u.role === UserRole.PARTENAIRE,
    ).length;
    const pendingValidations = allUsers.filter(
      (u) =>
        (u.role === UserRole.MENTOR ||
          u.role === UserRole.EXPERT ||
          u.role === UserRole.PARTENAIRE) &&
        u.statutCompte === AccountStatus.PENDING,
    ).length;

    const withSexe = allUsers.filter((u) => u.sexe !== null);
    const females = allUsers.filter((u) => u.sexe === Sexe.FEMME).length;
    const males = allUsers.filter((u) => u.sexe === Sexe.HOMME).length;
    const withResidence = allUsers.filter((u) => u.milieuResidence !== null);
    const rural = allUsers.filter(
      (u) => u.milieuResidence === MilieuResidence.RURAL,
    ).length;
    const urban = allUsers.filter(
      (u) => u.milieuResidence === MilieuResidence.URBAIN,
    ).length;
    const sdhCount = allUsers.filter((u) => u.situationHandicap).length;
    const withAge = allUsers.filter((u) => typeof u.age === 'number' && u.age > 0);
    const averageAge =
      withAge.length > 0
        ? Math.round(withAge.reduce((acc, u) => acc + (u.age ?? 0), 0) / withAge.length)
        : 0;
    const satisfactionRate = ratingAggregate._avg.rating
      ? Math.round((ratingAggregate._avg.rating / 5) * 100)
      : 0;

    return {
      user: {
        id: user.id,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        role: user.role,
        statutCompte: user.statutCompte,
        photoUrl: user.profile?.photoUrl ?? null,
      },
      opportunitiesSummary: {
        active: activeOpportunitiesCount,
        expired: expiredOpportunitiesCount,
      },
      recentOpportunities: allOpportunities.slice(0, 10),
      opportunities: allOpportunities,
      platformImpact: {
        totalBeneficiaries: allUsers.filter(
          (u) =>
            u.role === UserRole.BENEFICIAIRE && u.statutCompte === AccountStatus.ACTIVE,
        ).length,
        activeMentors,
        activePrograms,
        completedPrograms,
        completedSessions,
      },
      aggregatedStats: {
        totalUsers,
        totalBeneficiaries,
        totalMentors,
        totalPartners,
        pendingValidations,
        activePrograms,
        completedSessions,
        satisfactionRate,
        demographics: {
          femalePercentage:
            withSexe.length > 0 ? Math.round((females / withSexe.length) * 100) : 0,
          malePercentage:
            withSexe.length > 0 ? Math.round((males / withSexe.length) * 100) : 0,
          ruralPercentage:
            withResidence.length > 0
              ? Math.round((rural / withResidence.length) * 100)
              : 0,
          urbanPercentage:
            withResidence.length > 0
              ? Math.round((urban / withResidence.length) * 100)
              : 0,
          sdhPercentage: totalUsers > 0 ? Math.round((sdhCount / totalUsers) * 100) : 0,
          averageAge,
        },
      },
    };
  }
}
