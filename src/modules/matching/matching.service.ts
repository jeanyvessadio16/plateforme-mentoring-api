import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service.js';
import { AccountStatus } from '../../generated/prisma/client.js';

export interface MatchingDetailScores {
  expertiseScore: number;
  objectiveScore: number;
  sectorScore: number;
  availabilityScore: number;
  languageScore: number;
  formatScore: number;
}

export interface RecommendationResult {
  mentorId: string;
  mentorProfileId: string;
  nom: string;
  prenom: string;
  email: string;
  photoUrl: string | null;
  fonction: string;
  organisation: string;
  anneesExperience: number;
  expertises: string[];
  secteurs: string[];
  langues: string[];
  typesMentoring: string;
  scoreTotal: number;
  detailsScores: MatchingDetailScores;
  justification: string;
}

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  // Poids par défaut issus du cahier des charges (F05)
  private readonly DEFAULT_WEIGHTS = {
    expertise: 0.30,
    objective: 0.25,
    sector: 0.15,
    availability: 0.10,
    language: 0.10,
    format: 0.10,
  };

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calcule et enregistre les recommandations de mentors pour un bénéficiaire
   */
  async computeMatchingForUser(userId: string): Promise<RecommendationResult[]> {
    this.logger.log(`Calcul du matching algorithmique pour l'utilisateur ${userId}`);

    // 1. Récupérer le diagnostic du bénéficiaire
    const diagnostic = await this.prisma.diagnostic.findUnique({
      where: { userId },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
    });

    if (!diagnostic || !diagnostic.isCompleted) {
      this.logger.warn(`Diagnostic incomplet ou introuvable pour l'utilisateur ${userId}`);
      return [];
    }

    // 2. Récupérer tous les mentors validés et actifs
    const mentors = await this.prisma.mentorProfile.findMany({
      where: {
        statutValidation: AccountStatus.ACTIVE,
        isAvailable: true,
      },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
    });

    if (!mentors || mentors.length === 0) {
      this.logger.log('Aucun mentor actif disponible pour le matching pour le moment.');
      return [];
    }

    const userLangues = diagnostic.user.profile?.langues?.length
      ? diagnostic.user.profile.langues
      : [diagnostic.user.langue || 'fr'];

    // Charger la configuration de pondération dynamique si définie en base
    const weightConfig = await this.prisma.matchingWeightConfig.findFirst({
      orderBy: { updatedAt: 'desc' },
    });
    const weights = weightConfig
      ? {
          expertise: weightConfig.expertiseWeight,
          objective: weightConfig.objectiveWeight,
          sector: weightConfig.sectorWeight,
          availability: weightConfig.availabilityWeight,
          language: weightConfig.languageWeight,
          format: weightConfig.formatWeight,
        }
      : this.DEFAULT_WEIGHTS;

    const recommendations: RecommendationResult[] = [];
    const upsertOperations = [];

    // 3. Calcul du score pour chaque mentor
    for (const mentor of mentors) {
      const details = this.calculateCriteriaScores(diagnostic, mentor, userLangues);

      const scoreTotal = Number(
        (
          details.expertiseScore * weights.expertise +
          details.objectiveScore * weights.objective +
          details.sectorScore * weights.sector +
          details.availabilityScore * weights.availability +
          details.languageScore * weights.language +
          details.formatScore * weights.format
        ).toFixed(1)
      );

      const justification = this.generateJustification(details, mentor);

      recommendations.push({
        mentorId: mentor.userId,
        mentorProfileId: mentor.id,
        nom: mentor.user.nom,
        prenom: mentor.user.prenom,
        email: mentor.user.email,
        photoUrl: mentor.photoUrl || mentor.user.profile?.photoUrl || null,
        fonction: mentor.fonction,
        organisation: mentor.organisation,
        anneesExperience: mentor.anneesExperience,
        expertises: mentor.expertises,
        secteurs: mentor.secteurs,
        langues: mentor.langues,
        typesMentoring: mentor.typesMentoring,
        scoreTotal,
        detailsScores: details,
        justification,
      });

      upsertOperations.push(
        this.prisma.matchingResult.upsert({
          where: {
            menteeId_mentorId: {
              menteeId: userId,
              mentorId: mentor.id,
            },
          },
          create: {
            menteeId: userId,
            mentorId: mentor.id,
            scoreTotal,
            detailsScores: details as any,
            justification,
          },
          update: {
            scoreTotal,
            detailsScores: details as any,
            justification,
            createdAt: new Date(),
          },
        }),
      );
    }

    // 4. Persistance en lot via transaction
    if (upsertOperations.length > 0) {
      await this.prisma.$transaction(upsertOperations);
    }

    // Tri par score de compatibilité décroissant
    recommendations.sort((a, b) => b.scoreTotal - a.scoreTotal);

    this.logger.log(
      `Matching terminé pour ${userId} : ${recommendations.length} mentors évalués. Meilleur score: ${recommendations[0]?.scoreTotal}%`
    );

    return recommendations;
  }

  /**
   * Récupère les recommandations existantes ou déclenche le calcul si nécessaire
   */
  async getRecommendations(userId: string): Promise<RecommendationResult[]> {
    // Vérifier si des résultats existent déjà
    const savedResults = await this.prisma.matchingResult.findMany({
      where: { menteeId: userId },
      include: {
        mentor: {
          include: {
            user: {
              include: {
                profile: true,
              },
            },
          },
        },
      },
      orderBy: { scoreTotal: 'desc' },
      take: 15,
    });

    if (savedResults.length > 0) {
      return savedResults.map((r) => ({
        mentorId: r.mentor.userId,
        mentorProfileId: r.mentor.id,
        nom: r.mentor.user.nom,
        prenom: r.mentor.user.prenom,
        email: r.mentor.user.email,
        photoUrl: r.mentor.photoUrl || r.mentor.user.profile?.photoUrl || null,
        fonction: r.mentor.fonction,
        organisation: r.mentor.organisation,
        anneesExperience: r.mentor.anneesExperience,
        expertises: r.mentor.expertises,
        secteurs: r.mentor.secteurs,
        langues: r.mentor.langues,
        typesMentoring: r.mentor.typesMentoring,
        scoreTotal: r.scoreTotal,
        detailsScores: r.detailsScores as any,
        justification: r.justification,
      }));
    }

    // Si aucun résultat stocké, calculer à la volée
    return this.computeMatchingForUser(userId);
  }

  /**
   * Calcul des sous-scores pour les 6 critères F05
   */
  private calculateCriteriaScores(
    diagnostic: any,
    mentor: any,
    userLangues: string[]
  ): MatchingDetailScores {
    // 1. Expertise (30%) : Correspondance entre compétences/besoins recherchés et expertises du mentor
    const targetSkills = [
      ...(diagnostic.competences || []),
      ...(diagnostic.besoins || []),
    ].map((s: string) => s.toLowerCase());

    const mentorSkills = (mentor.expertises || []).map((e: string) => e.toLowerCase());

    let expertiseMatches = 0;
    for (const skill of targetSkills) {
      if (mentorSkills.some((ms: string) => ms.includes(skill) || skill.includes(ms))) {
        expertiseMatches++;
      }
    }
    const expertiseScore = targetSkills.length > 0
      ? Math.min(100, Math.round((expertiseMatches / Math.max(1, targetSkills.length * 0.5)) * 100))
      : 50;

    // 2. Objectif principal & Domaine (25%)
    const objText = `${diagnostic.objectifPrincipal} ${diagnostic.domaine}`.toLowerCase();
    const mentorBio = `${mentor.biographie} ${(mentor.publicsAccompagnes || []).join(' ')}`.toLowerCase();
    let objScore = 40;
    if (mentorSkills.some((ms: string) => objText.includes(ms))) {
      objScore += 35;
    }
    if (mentorBio.includes(diagnostic.domaine.toLowerCase()) || mentorBio.includes(diagnostic.niveau.toLowerCase())) {
      objScore += 25;
    }
    const objectiveScore = Math.min(100, objScore);

    // 3. Secteur d'activité (15%)
    const diagSecteur = diagnostic.secteur.toLowerCase();
    const diagDomaine = diagnostic.domaine.toLowerCase();
    const mentorSecteurs = (mentor.secteurs || []).map((s: string) => s.toLowerCase());

    let sectorScore = 30;
    if (mentorSecteurs.some((ms: string) => ms.includes(diagSecteur) || diagSecteur.includes(ms))) {
      sectorScore = 100;
    } else if (mentorSecteurs.some((ms: string) => ms.includes(diagDomaine) || diagDomaine.includes(ms))) {
      sectorScore = 75;
    }

    // 4. Disponibilité temporelle (10%)
    const diagDisp = (diagnostic.disponibilite || '').toLowerCase();
    const mentorDisp = (mentor.disponibilites || '').toLowerCase();
    let availabilityScore = 60;
    if (diagDisp === 'flexible' || mentorDisp.includes('flexible')) {
      availabilityScore = 100;
    } else if (
      (diagDisp.includes('soir') && mentorDisp.includes('soir')) ||
      (diagDisp.includes('weekend') && mentorDisp.includes('weekend')) ||
      (diagDisp.includes('semaine') && mentorDisp.includes('semaine'))
    ) {
      availabilityScore = 95;
    }

    // 5. Langues communes (10%)
    const mentorLangues = (mentor.langues || []).map((l: string) => l.toLowerCase());
    const commonLang = userLangues.some((l: string) =>
      mentorLangues.includes(l.toLowerCase())
    );
    const languageScore = commonLang ? 100 : 20;

    // 6. Format d'accompagnement (10%)
    const diagFormat = (diagnostic.typeAccompagnement || '').toUpperCase();
    const mentorFormat = (mentor.typesMentoring || '').toUpperCase();
    let formatScore = 50;
    if (mentorFormat === 'LES_DEUX' || mentorFormat === diagFormat) {
      formatScore = 100;
    } else if (diagFormat === 'LES_DEUX') {
      formatScore = 80;
    }

    return {
      expertiseScore,
      objectiveScore,
      sectorScore,
      availabilityScore,
      languageScore,
      formatScore,
    };
  }

  /**
   * Génère une explication textuelle bienveillante et contextualisée
   */
  private generateJustification(details: MatchingDetailScores, mentor: any): string {
    const reasons: string[] = [];

    if (details.expertiseScore >= 75) {
      reasons.push(`Forte synergie sur vos compétences prioritaires (${mentor.expertises.slice(0, 2).join(', ')})`);
    }
    if (details.sectorScore >= 75) {
      reasons.push(`Excellente connaissance de votre secteur d'activité (${mentor.secteurs[0] || 'spécialisé'})`);
    }
    if (details.formatScore === 100) {
      reasons.push('Format de mentoring parfaitement aligné');
    }
    if (details.availabilityScore >= 80) {
      reasons.push('Disponibilités horaires compatibles');
    }

    if (reasons.length === 0) {
      return `Profil expérimenté (${mentor.anneesExperience} ans d'expérience chez ${mentor.organisation}) pouvant vous guider dans votre progression.`;
    }

    return reasons.join(' · ') + '.';
  }
}
