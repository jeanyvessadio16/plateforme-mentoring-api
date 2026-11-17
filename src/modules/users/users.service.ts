import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service.js';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère le profil complet de l'utilisateur connecté
   */
  async getMyProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        mentorProfile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    return user;
  }

  /**
   * Met à jour les informations du profil utilisateur
   */
  async updateProfile(userId: string, dto: UpdateUserProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    // Mise à jour de l'utilisateur de base
    const userUpdateData: any = {};
    if (dto.nom !== undefined) userUpdateData.nom = dto.nom;
    if (dto.prenom !== undefined) userUpdateData.prenom = dto.prenom;
    if (dto.telephone !== undefined) userUpdateData.telephone = dto.telephone;
    if (dto.pays !== undefined) userUpdateData.pays = dto.pays;

    // Mise à jour du profil détaillé
    const profileUpdateData: any = {};
    if (dto.photoUrl !== undefined) profileUpdateData.photoUrl = dto.photoUrl;
    if (dto.ville !== undefined) profileUpdateData.ville = dto.ville;
    if (dto.localisation !== undefined) profileUpdateData.localisation = dto.localisation;
    if (dto.niveauEtude !== undefined) profileUpdateData.niveauEtude = dto.niveauEtude;
    if (dto.secteurActivite !== undefined) profileUpdateData.secteurActivite = dto.secteurActivite;
    if (dto.anneesExperience !== undefined) profileUpdateData.anneesExperience = dto.anneesExperience;
    if (dto.competences !== undefined) profileUpdateData.competences = dto.competences;
    if (dto.centresInteret !== undefined) profileUpdateData.centresInteret = dto.centresInteret;
    if (dto.objectifs !== undefined) profileUpdateData.objectifs = dto.objectifs;
    if (dto.langues !== undefined) profileUpdateData.langues = dto.langues;
    if (dto.disponibilite !== undefined) profileUpdateData.disponibilite = dto.disponibilite;
    if (dto.isPublic !== undefined) profileUpdateData.isPublic = dto.isPublic;

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...userUpdateData,
        profile: {
          upsert: {
            create: profileUpdateData,
            update: profileUpdateData,
          },
        },
      },
      include: {
        profile: true,
      },
    });
  }

  /**
   * Récupère le profil public d'un utilisateur (si autorisé)
   */
  async getPublicProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
      },
    });

    if (!user || !user.profile) {
      throw new NotFoundException('Profil introuvable.');
    }

    if (!user.profile.isPublic) {
      throw new ForbiddenException('Ce profil est privé.');
    }

    // Filtre des informations privées (RGPD)
    return {
      id: user.id,
      prenom: user.prenom,
      nom: user.nom.charAt(0) + '.', // Anonymisation partielle du nom sur profil public
      pays: user.pays,
      photoUrl: user.profile.photoUrl,
      ville: user.profile.ville,
      niveauEtude: user.profile.niveauEtude,
      secteurActivite: user.profile.secteurActivite,
      competences: user.profile.competences,
      centresInteret: user.profile.centresInteret,
      langues: user.profile.langues,
    };
  }

  /**
   * Suppression de compte et données personnelles (Droit à l'oubli RGPD)
   */
  async deleteAccount(userId: string) {
    await this.prisma.user.delete({
      where: { id: userId },
    });

    return { message: 'Compte supprimé avec succès conformément aux règles de protection des données.' };
  }
}
