import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service.js';
import { ApplyMentorDto } from './dto/apply-mentor.dto.js';
import { FilterMentorsDto } from './dto/filter-mentors.dto.js';
import { AccountStatus, UserRole } from '../../generated/prisma/client.js';

@Injectable()
export class MentorsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Soumission ou mise à jour d'une candidature mentor (F03)
   */
  async apply(userId: string, dto: ApplyMentorDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { mentorProfile: true },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    // Création ou mise à jour du profil mentor
    const mentorProfile = await this.prisma.mentorProfile.upsert({
      where: { userId },
      create: {
        userId,
        fonction: dto.fonction,
        organisation: dto.organisation,
        anneesExperience: dto.anneesExperience,
        expertises: dto.expertises,
        secteurs: dto.secteurs,
        langues: dto.langues,
        publicsAccompagnes: dto.publicsAccompagnes,
        typesMentoring: dto.typesMentoring,
        disponibilites: dto.disponibilites,
        biographie: dto.biographie,
        photoUrl: dto.photoUrl,
        cvUrl: dto.cvUrl,
        references: dto.references,
        statutValidation: AccountStatus.PENDING, // Toujours soumis à validation administrative
        isAvailable: true,
      },
      update: {
        fonction: dto.fonction,
        organisation: dto.organisation,
        anneesExperience: dto.anneesExperience,
        expertises: dto.expertises,
        secteurs: dto.secteurs,
        langues: dto.langues,
        publicsAccompagnes: dto.publicsAccompagnes,
        typesMentoring: dto.typesMentoring,
        disponibilites: dto.disponibilites,
        biographie: dto.biographie,
        photoUrl: dto.photoUrl,
        cvUrl: dto.cvUrl,
        references: dto.references,
      },
    });

    // Mettre à jour le rôle de l'utilisateur en MENTOR si ce n'est pas déjà le cas
    if (user.role !== UserRole.MENTOR && user.role !== UserRole.ADMIN) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          role: UserRole.MENTOR,
          statutCompte: AccountStatus.PENDING,
        },
      });
    }

    return {
      message: 'Votre candidature mentor a été enregistrée et est en cours d’examen par l’équipe d’administration.',
      mentorProfile,
    };
  }

  /**
   * Récupère le profil mentor de l'utilisateur connecté
   */
  async getMyMentorProfile(userId: string) {
    const mentorProfile = await this.prisma.mentorProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            email: true,
            pays: true,
            statutCompte: true,
          },
        },
      },
    });

    if (!mentorProfile) {
      throw new NotFoundException('Profil mentor non trouvé pour cet utilisateur.');
    }

    return mentorProfile;
  }

  /**
   * Suspendre ou réactiver temporairement sa disponibilité (F03)
   */
  async updateAvailability(userId: string, isAvailable: boolean) {
    const mentorProfile = await this.prisma.mentorProfile.findUnique({
      where: { userId },
    });

    if (!mentorProfile) {
      throw new NotFoundException('Profil mentor non trouvé.');
    }

    return this.prisma.mentorProfile.update({
      where: { userId },
      data: { isAvailable },
    });
  }

  /**
   * Moteur de recherche et catalogue des mentors validés (F06)
   * Règle métier : seuls les mentors avec statutValidation: ACTIVE et isAvailable: true sont visibles.
   */
  async findMentors(filter: FilterMentorsDto) {
    const page = filter.page || 1;
    const limit = filter.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {
      statutValidation: AccountStatus.ACTIVE,
      isAvailable: true,
    };

    if (filter.expertise) {
      where.expertises = { has: filter.expertise };
    }

    if (filter.secteur) {
      where.secteurs = { has: filter.secteur };
    }

    if (filter.langue) {
      where.langues = { has: filter.langue };
    }

    if (filter.typesMentoring) {
      where.typesMentoring = filter.typesMentoring;
    }

    if (filter.pays) {
      where.user = {
        ...where.user,
        pays: { contains: filter.pays, mode: 'insensitive' },
      };
    }

    if (filter.ville) {
      where.user = {
        ...where.user,
        profile: {
          ville: { contains: filter.ville, mode: 'insensitive' },
        },
      };
    }

    if (filter.search) {
      where.OR = [
        { fonction: { contains: filter.search, mode: 'insensitive' } },
        { organisation: { contains: filter.search, mode: 'insensitive' } },
        { biographie: { contains: filter.search, mode: 'insensitive' } },
        {
          user: {
            OR: [
              { nom: { contains: filter.search, mode: 'insensitive' } },
              { prenom: { contains: filter.search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const [total, mentors] = await Promise.all([
      this.prisma.mentorProfile.count({ where }),
      this.prisma.mentorProfile.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              nom: true,
              prenom: true,
              pays: true,
            },
          },
        },
        orderBy: {
          anneesExperience: 'desc',
        },
      }),
    ]);

    return {
      data: mentors,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Consulter la fiche complète d'un mentor
   */
  async getMentorById(mentorProfileId: string) {
    const mentor = await this.prisma.mentorProfile.findUnique({
      where: { id: mentorProfileId },
      include: {
        user: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            pays: true,
          },
        },
      },
    });

    if (!mentor) {
      throw new NotFoundException('Fiche mentor introuvable.');
    }

    if (mentor.statutValidation !== AccountStatus.ACTIVE) {
      throw new ForbiddenException('Ce profil mentor n’est pas accessible publiquement.');
    }

    return mentor;
  }
}
