import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service.js';
import { MatchingService } from '../matching/matching.service.js';
import { SubmitDiagnosticDto } from './dto/submit-diagnostic.dto.js';

@Injectable()
export class DiagnosticService {
  private readonly logger = new Logger(DiagnosticService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly matchingService: MatchingService,
  ) {}

  /**
   * F04 - Enregistre ou met à jour le diagnostic d'un bénéficiaire
   * et déclenche immédiatement le calcul de matching (F05)
   */
  async submitDiagnostic(userId: string, dto: SubmitDiagnosticDto) {
    this.logger.log(`Soumission du diagnostic pour l'utilisateur ${userId}`);

    // Vérifier l'existence de l'utilisateur
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    // 1. Enregistrement ou mise à jour du diagnostic
    const diagnostic = await this.prisma.diagnostic.upsert({
      where: { userId },
      create: {
        userId,
        situation: dto.situation,
        objectifPrincipal: dto.objectifPrincipal,
        domaine: dto.domaine,
        niveau: dto.niveau,
        typeAccompagnement: dto.typeAccompagnement,
        competences: dto.competences,
        besoins: dto.besoins,
        secteur: dto.secteur,
        contraintes: dto.contraintes || [],
        disponibilite: dto.disponibilite,
        preferenceMentoring: dto.preferenceMentoring,
        isCompleted: true,
        profilBesoin: {
          niveau: dto.niveau,
          secteur: dto.secteur,
          competences: dto.competences,
          besoins: dto.besoins,
          typeAccompagnement: dto.typeAccompagnement,
        },
      },
      update: {
        situation: dto.situation,
        objectifPrincipal: dto.objectifPrincipal,
        domaine: dto.domaine,
        niveau: dto.niveau,
        typeAccompagnement: dto.typeAccompagnement,
        competences: dto.competences,
        besoins: dto.besoins,
        secteur: dto.secteur,
        contraintes: dto.contraintes || [],
        disponibilite: dto.disponibilite,
        preferenceMentoring: dto.preferenceMentoring,
        isCompleted: true,
        profilBesoin: {
          niveau: dto.niveau,
          secteur: dto.secteur,
          competences: dto.competences,
          besoins: dto.besoins,
          typeAccompagnement: dto.typeAccompagnement,
        },
        updatedAt: new Date(),
      },
    });

    // 2. Synchroniser le profil utilisateur avec les compétences et objectifs choisis
    const existingSkills = user.profile?.competences || [];
    const mergedSkills = Array.from(new Set([...existingSkills, ...dto.competences]));

    const existingObjectives = user.profile?.objectifs || [];
    const mergedObjectives = Array.from(
      new Set([...existingObjectives, dto.objectifPrincipal, ...dto.besoins])
    );

    await this.prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        secteurActivite: dto.secteur,
        competences: mergedSkills,
        objectifs: mergedObjectives,
        disponibilite: dto.disponibilite,
      },
      update: {
        secteurActivite: dto.secteur,
        competences: mergedSkills,
        objectifs: mergedObjectives,
        disponibilite: dto.disponibilite,
        updatedAt: new Date(),
      },
    });

    // 3. Calculer immédiatement les mentors compatibles (F05)
    const recommendations = await this.matchingService.computeMatchingForUser(userId);

    return {
      message: 'Votre diagnostic a été enregistré et validé avec succès !',
      diagnostic,
      recommendationsCount: recommendations.length,
      topRecommendations: recommendations.slice(0, 5),
      redirectUrl: '/dashboard/beneficiaire',
    };
  }

  /**
   * Consultation du diagnostic actuel de l'utilisateur
   */
  async getMyDiagnostic(userId: string) {
    const diagnostic = await this.prisma.diagnostic.findUnique({
      where: { userId },
    });

    return {
      isCompleted: !!diagnostic?.isCompleted,
      diagnostic: diagnostic || null,
    };
  }

  /**
   * Récupère les mentors recommandés suite au diagnostic
   */
  async getRecommendations(userId: string) {
    return this.matchingService.getRecommendations(userId);
  }

  /**
   * F05 - Recalcule manuellement le matching pour un diagnostic déjà complété
   */
  async recalculateMatching(userId: string) {
    const diagnostic = await this.prisma.diagnostic.findUnique({ where: { userId } });
    if (!diagnostic || !diagnostic.isCompleted) {
      throw new NotFoundException('Aucun diagnostic complété trouvé pour cet utilisateur.');
    }

    const recommendations = await this.matchingService.computeMatchingForUser(userId);
    return {
      message: 'Matching recalculé avec succès.',
      recommendationsCount: recommendations.length,
      recommendations,
    };
  }
}
