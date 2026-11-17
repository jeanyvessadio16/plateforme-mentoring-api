import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service.js';
import { SyncUserDto } from './dto/sync-user.dto.js';
import { AccountStatus, UserRole } from '../../generated/prisma/client.js';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Synchronise l'utilisateur authentifié depuis Supabase dans la base locale
   */
  async syncUser(currentUser: any, dto: SyncUserDto) {
    const supabaseUid = currentUser.supabaseUid;
    const email = currentUser.email;

    if (!supabaseUid || !email) {
      throw new BadRequestException('Jeton d’authentification incomplet.');
    }

    if (!dto.consentCgu || !dto.consentData) {
      throw new BadRequestException(
        'L’acceptation des CGU et le consentement aux données personnelles sont obligatoires.',
      );
    }

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ supabaseUid }, { email }],
      },
    });

    if (existingUser) {
      throw new ConflictException('Un compte existe déjà pour cet utilisateur.');
    }

    // Règles métier (F01) : les profils mentor, expert et partenaire sont soumis à validation administrative
    const statutCompte =
      dto.role === UserRole.BENEFICIAIRE
        ? AccountStatus.ACTIVE
        : AccountStatus.PENDING;

    // Création transactionnelle de l'utilisateur et de son profil initial
    const user = await this.prisma.user.create({
      data: {
        supabaseUid,
        email,
        nom: dto.nom,
        prenom: dto.prenom,
        telephone: dto.telephone,
        pays: dto.pays,
        role: dto.role,
        statutCompte,
        langue: dto.langue || 'fr',
        consentCgu: dto.consentCgu,
        consentData: dto.consentData,
        // Profil bénéficiaire initial
        profile: {
          create: {
            competences: [],
            centresInteret: [],
            objectifs: [],
            langues: [dto.langue || 'fr'],
          },
        },
      },
      include: {
        profile: true,
        mentorProfile: true,
      },
    });

    return user;
  }

  /**
   * Récupère le profil complet de l'utilisateur connecté
   */
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        mentorProfile: true,
        diagnostic: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    return user;
  }
}
