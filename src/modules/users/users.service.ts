import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service.js';
import { SupabaseService } from '../../core/supabase/supabase.service.js';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto.js';

const PROFILE_AVATAR_BUCKET = 'plateforme-images';
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabaseService: SupabaseService,
  ) {}

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
    if (dto.age !== undefined) userUpdateData.age = dto.age;
    if (dto.sexe !== undefined) userUpdateData.sexe = dto.sexe;
    if (dto.milieuResidence !== undefined) userUpdateData.milieuResidence = dto.milieuResidence;
    if (dto.situationHandicap !== undefined) {
      userUpdateData.situationHandicap = dto.situationHandicap;
    } else if (dto.sdh !== undefined) {
      userUpdateData.situationHandicap = dto.sdh;
    }
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
        mentorProfile: true,
      },
    });
  }

  private detectImageFormat(buffer: Buffer): { mimeType: string; ext: string } | null {
    if (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    ) {
      return { mimeType: 'image/jpeg', ext: 'jpg' };
    }
    if (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return { mimeType: 'image/png', ext: 'png' };
    }
    if (
      buffer.length >= 12 &&
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) {
      return { mimeType: 'image/webp', ext: 'webp' };
    }
    return null;
  }

  private extractOwnedAvatarStoragePath(
    publicUrl: string | null | undefined,
    userId: string,
  ): string | null {
    const supabaseUrl = this.supabaseService.getSupabaseUrl();
    if (!publicUrl || !supabaseUrl || !userId) {
      return null;
    }

    const baseUrl = supabaseUrl.replace(/\/+$/, '');
    const prefix = `${baseUrl}/storage/v1/object/public/${PROFILE_AVATAR_BUCKET}/`;
    if (!publicUrl.startsWith(prefix)) {
      return null;
    }

    const relativePath = decodeURIComponent(
      publicUrl.slice(prefix.length).split('?')[0],
    );
    if (!relativePath.startsWith(`avatars/${userId}/`)) {
      return null;
    }
    return relativePath;
  }

  async uploadAvatar(userId: string, base64Data: string) {
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

    const cleaned = base64Data.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '').trim();
    if (!cleaned) {
      throw new BadRequestException('Le fichier sélectionné est vide.');
    }

    const buffer = Buffer.from(cleaned, 'base64');
    if (buffer.length === 0) {
      throw new BadRequestException('Le fichier sélectionné est vide.');
    }
    if (buffer.length > MAX_AVATAR_BYTES) {
      throw new BadRequestException('La photo ne doit pas dépasser 5 Mo.');
    }

    const detected = this.detectImageFormat(buffer);
    if (!detected) {
      throw new BadRequestException(
        'Format non supporté. Veuillez choisir une image JPG, PNG ou WEBP.',
      );
    }

    const storagePath = `avatars/${userId}/avatar-${Date.now()}.${detected.ext}`;
    const publicUrl = await this.supabaseService.uploadFile(
      PROFILE_AVATAR_BUCKET,
      storagePath,
      buffer,
      detected.mimeType,
    );

    try {
      await this.prisma.userProfile.upsert({
        where: { userId },
        create: {
          userId,
          photoUrl: publicUrl,
          competences: [],
          centresInteret: [],
          objectifs: [],
          langues: [],
          isPublic: true,
        },
        update: {
          photoUrl: publicUrl,
        },
      });

      if (user.mentorProfile) {
        await this.prisma.mentorProfile.update({
          where: { userId },
          data: { photoUrl: publicUrl },
        });
      }
    } catch (err) {
      await this.supabaseService.removeFile(PROFILE_AVATAR_BUCKET, storagePath);
      throw err;
    }

    const oldPath = this.extractOwnedAvatarStoragePath(user.profile?.photoUrl, userId);
    if (oldPath && oldPath !== storagePath) {
      await this.supabaseService.removeFile(PROFILE_AVATAR_BUCKET, oldPath);
    }

    return {
      photoUrl: publicUrl,
      message: 'Photo de profil mise à jour avec succès.',
    };
  }

  async deleteAvatar(userId: string) {
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

    if (user.profile) {
      await this.prisma.userProfile.update({
        where: { userId },
        data: { photoUrl: null },
      });
    }

    if (user.mentorProfile) {
      await this.prisma.mentorProfile.update({
        where: { userId },
        data: { photoUrl: null },
      });
    }

    const oldPath = this.extractOwnedAvatarStoragePath(user.profile?.photoUrl, userId);
    if (oldPath) {
      await this.supabaseService.removeFile(PROFILE_AVATAR_BUCKET, oldPath);
    }

    return {
      photoUrl: null,
      message: 'Photo de profil supprimée.',
    };
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
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, supabaseUid: true },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    if (user.supabaseUid) {
      const adminClient = this.supabaseService.getAdminClient();
      const { error } = await adminClient.auth.admin.deleteUser(user.supabaseUid);
      if (error && error.code !== 'user_not_found' && !error.message?.toLowerCase().includes('not found')) {
        this.logger.error(`Échec suppression Supabase Auth (${user.supabaseUid}): ${error.message}`);
        throw new InternalServerErrorException(
          'Impossible de supprimer le compte dans le service d’authentification.',
        );
      }
    }

    await this.prisma.user.delete({
      where: { id: userId },
    });

    return { message: 'Compte supprimé avec succès conformément aux règles de protection des données.' };
  }

  /**
   * Export complet des données personnelles de l'utilisateur connecté (RGPD)
   */
  async exportMyData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        mentorProfile: true,
        diagnostic: true,
        matchingResults: true,
        mentorshipRequestsSent: true,
        mentorshipRequestsReceived: true,
        programsAsMentee: {
          include: { goals: true, tasks: true, resources: true },
        },
        programsAsMentor: {
          include: { goals: true, tasks: true, resources: true },
        },
        sessionsAsMentee: true,
        sessionsAsMentor: true,
        masterclassRegistrations: {
          include: { masterclass: true },
        },
        favoriteOpportunities: {
          include: { opportunity: true },
        },
        notifications: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    return {
      exportedAt: new Date().toISOString(),
      user,
    };
  }
}
