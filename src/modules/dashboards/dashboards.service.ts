import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service.js';
import {
  AccountStatus,
  MasterclassStatus,
  OpportunityStatus,
  ProgramStatus,
  RequestStatus,
  SessionStatus,
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
    ]);

    return {
      activeMentors,
      activeBeneficiaries,
      completedSessions,
      activeOpportunities,
      upcomingMasterclasses,
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
      nextSession,
      topRecommendations,
      recommendedOpportunities,
      upcomingMasterclasses,
      unreadNotificationsCount,
    ] = await Promise.all([
      this.prisma.mentorshipProgram.findMany({
        where: { menteeId: userId, status: ProgramStatus.ACTIVE },
        include: {
          mentor: { select: { id: true, nom: true, prenom: true } },
          goals: { orderBy: { createdAt: 'asc' } },
          tasks: {
            where: { status: { not: TaskStatus.COMPLETED } },
            orderBy: { echeance: 'asc' },
          },
          resources: { orderBy: { createdAt: 'desc' }, take: 5 },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.mentorshipSession.findFirst({
        where: {
          menteeId: userId,
          status: { in: [SessionStatus.SCHEDULED, SessionStatus.RESCHEDULED] },
          dateDebut: { gte: now },
        },
        include: {
          mentor: { select: { id: true, nom: true, prenom: true } },
        },
        orderBy: { dateDebut: 'asc' },
      }),
      this.prisma.matchingResult.findMany({
        where: { menteeId: userId },
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

    return {
      user: {
        id: user.id,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        pays: user.pays,
        statutCompte: user.statutCompte,
        profileCompletion: this.computeProfileCompletion(user),
      },
      diagnostic: user.diagnostic,
      activePrograms,
      nextSession,
      topRecommendations,
      recommendedOpportunities,
      upcomingMasterclasses,
      unreadNotificationsCount,
    };
  }

  async getMentorDashboard(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { mentorProfile: true },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    const now = new Date();
    const [
      pendingRequests,
      totalRequestsCount,
      activePrograms,
      upcomingSessions,
      activeSlots,
      openTasksCount,
      unreadMessagesCount,
      unreadNotificationsCount,
    ] = await Promise.all([
      this.prisma.mentorshipRequest.findMany({
        where: { mentorId: userId, status: RequestStatus.PENDING },
        include: {
          mentee: { select: { id: true, nom: true, prenom: true, pays: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.mentorshipRequest.count({ where: { mentorId: userId } }),
      this.prisma.mentorshipProgram.findMany({
        where: { mentorId: userId, status: ProgramStatus.ACTIVE },
        include: {
          mentee: { select: { id: true, nom: true, prenom: true } },
          _count: { select: { goals: true, tasks: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.mentorshipSession.findMany({
        where: {
          mentorId: userId,
          status: { in: [SessionStatus.SCHEDULED, SessionStatus.RESCHEDULED] },
          dateDebut: { gte: now },
        },
        include: {
          mentee: { select: { id: true, nom: true, prenom: true } },
        },
        orderBy: { dateDebut: 'asc' },
        take: 10,
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

    return {
      user: {
        id: user.id,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        statutCompte: user.statutCompte,
      },
      mentorProfile: user.mentorProfile,
      pendingRequests,
      totalRequestsCount,
      activePrograms,
      upcomingSessions,
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
    const [masterclasses, upcomingSessions, completedSessionsCount, unreadNotificationsCount] =
      await Promise.all([
        this.prisma.masterclass.findMany({
          orderBy: { dateSession: 'asc' },
          take: 10,
          include: { _count: { select: { registrations: true } } },
        }),
        this.prisma.mentorshipSession.findMany({
          where: {
            mentorId: userId,
            status: { in: [SessionStatus.SCHEDULED, SessionStatus.RESCHEDULED] },
            dateDebut: { gte: now },
          },
          include: {
            mentee: { select: { id: true, nom: true, prenom: true } },
          },
          orderBy: { dateDebut: 'asc' },
        }),
        this.prisma.mentorshipSession.count({
          where: { mentorId: userId, status: SessionStatus.COMPLETED },
        }),
        this.prisma.notification.count({
          where: { userId, isRead: false },
        }),
      ]);

    return {
      user: {
        id: user.id,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        statutCompte: user.statutCompte,
      },
      mentorProfile: user.mentorProfile,
      masterclasses,
      upcomingSessions,
      completedSessionsCount,
      unreadNotificationsCount,
    };
  }

  async getPartnerDashboard(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, nom: true, prenom: true, email: true, role: true },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    const [
      activeOpportunitiesCount,
      expiredOpportunitiesCount,
      recentOpportunities,
      totalBeneficiaries,
      activeMentors,
      activePrograms,
      completedPrograms,
      completedSessions,
    ] = await Promise.all([
      this.prisma.opportunity.count({ where: { status: OpportunityStatus.ACTIVE } }),
      this.prisma.opportunity.count({ where: { status: OpportunityStatus.EXPIRED } }),
      this.prisma.opportunity.findMany({
        where: { status: OpportunityStatus.ACTIVE },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.user.count({
        where: { role: UserRole.BENEFICIAIRE, statutCompte: AccountStatus.ACTIVE },
      }),
      this.prisma.mentorProfile.count({
        where: { statutValidation: AccountStatus.ACTIVE, isAvailable: true },
      }),
      this.prisma.mentorshipProgram.count({ where: { status: ProgramStatus.ACTIVE } }),
      this.prisma.mentorshipProgram.count({ where: { status: ProgramStatus.COMPLETED } }),
      this.prisma.mentorshipSession.count({ where: { status: SessionStatus.COMPLETED } }),
    ]);

    return {
      user,
      opportunitiesSummary: {
        active: activeOpportunitiesCount,
        expired: expiredOpportunitiesCount,
      },
      recentOpportunities,
      platformImpact: {
        totalBeneficiaries,
        activeMentors,
        activePrograms,
        completedPrograms,
        completedSessions,
      },
    };
  }
}
