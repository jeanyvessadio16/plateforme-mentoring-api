import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../core/database/prisma.service.js';
import { SupabaseService } from '../../core/supabase/supabase.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';
import { SyncUserDto } from './dto/sync-user.dto.js';
import {
  AccountStatus,
  MentorshipType,
  UserRole,
} from '../../generated/prisma/client.js';

const CV_STORAGE_BUCKET = 'mentor-documents';
const MAX_CV_FILE_BYTES = 5 * 1024 * 1024;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) { }

  /**
   * Retourne l'URL de base du tableau de bord selon le rôle de l'utilisateur
   */
  getDashboardUrl(role: UserRole): string {
    switch (role) {
      case UserRole.ADMIN:
        return '/admin';
      case UserRole.MENTOR:
        return '/dashboard/mentor';
      case UserRole.EXPERT:
        return '/dashboard/expert';
      case UserRole.PARTENAIRE:
        return '/dashboard/partenaire';
      case UserRole.BENEFICIAIRE:
      default:
        return '/dashboard/beneficiaire';
    }
  }

  /**
   * Calcule l'URL de redirection contextuelle vers l'espace de l'utilisateur
   * (ex: /diagnostic si le bénéficiaire n'a pas fait son diagnostic, ou tableau de bord dédié)
   */
  getRedirectUrl(user: any): string {
    switch (user.role) {
      case UserRole.ADMIN:
        return '/admin';

      case UserRole.MENTOR:
        if (!user.mentorProfile || user.mentorProfile.statutValidation === AccountStatus.PENDING) {
          return '/dashboard/mentor/candidature';
        }
        return '/dashboard/mentor';

      case UserRole.EXPERT:
        return '/dashboard/expert';

      case UserRole.PARTENAIRE:
        return '/dashboard/partenaire';

      case UserRole.BENEFICIAIRE:
      default:
        // Si le diagnostic initial (F04) n'a pas encore été complété, orienter vers le diagnostic
        if (!user.diagnostic || !user.diagnostic.isCompleted) {
          return '/diagnostic';
        }
        return '/dashboard/beneficiaire';
    }
  }

  private decodeAndValidatePdfBase64(rawBase64: string): Buffer {
    const cleaned = rawBase64
      .replace(/^data:application\/pdf;base64,/i, '')
      .trim();
    if (!cleaned) {
      throw new BadRequestException('Le fichier CV sélectionné est vide.');
    }

    const buffer = Buffer.from(cleaned, 'base64');
    if (buffer.length === 0) {
      throw new BadRequestException('Le fichier CV sélectionné est vide.');
    }

    if (buffer.length > MAX_CV_FILE_BYTES) {
      throw new BadRequestException('Le fichier CV ne doit pas dépasser 5 Mo.');
    }

    const isPdf =
      buffer.length >= 5 &&
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46 &&
      buffer[4] === 0x2d;

    if (!isPdf) {
      throw new BadRequestException(
        'Format non supporté. Veuillez téléverser votre CV au format PDF uniquement.',
      );
    }

    return buffer;
  }

  private resolveEmailRedirectTo(explicitUrl?: string): string {
    if (explicitUrl && /^https?:\/\//i.test(explicitUrl.trim())) {
      return explicitUrl.trim();
    }
    const configuredFrontend = this.configService.get<string>('FRONTEND_URL')?.trim();
    const baseUrl =
      configuredFrontend && /^https?:\/\//i.test(configuredFrontend)
        ? configuredFrontend.replace(/\/+$/, '')
        : 'https://acceent-mentoring.vercel.app';
    return `${baseUrl}/auth/callback`;
  }

  /**
   * F01 - Inscription d'un nouvel utilisateur (auth/register)
   */
  async register(dto: RegisterDto) {
    if (dto.role === UserRole.ADMIN) {
      throw new ForbiddenException(
        'La création d’un compte administrateur n’est pas autorisée via cette route.',
      );
    }

    if (!dto.consentCgu || !dto.consentData) {
      throw new BadRequestException(
        'L’acceptation des CGU et le consentement au traitement des données sont obligatoires.',
      );
    }

    const isMentorOrExpert =
      dto.role === UserRole.MENTOR || dto.role === UserRole.EXPERT;

    let cvBuffer: Buffer | null = null;
    if (isMentorOrExpert && dto.cvBase64) {
      cvBuffer = this.decodeAndValidatePdfBase64(dto.cvBase64);
    }

    // Vérifier si un compte existe déjà avec cette adresse email
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Un compte existe déjà avec cette adresse e-mail.');
    }

    const adminClient = this.supabaseService.getAdminClient();
    const publicClient = this.supabaseService.getClient();

    let supabaseUid: string;
    let signUpSession: {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      expires_at?: number;
      token_type: string;
    } | null = null;
    const autoConfirmed = this.configService.get<string>('AUTH_AUTO_CONFIRM') === 'true';

    if (autoConfirmed) {
      // Création directe de l'utilisateur avec e-mail pré-confirmé via la clé admin
      const { data: adminCreated, error: adminErr } =
        await adminClient.auth.admin.createUser({
          email: dto.email,
          password: dto.password,
          email_confirm: true,
          user_metadata: {
            nom: dto.nom,
            prenom: dto.prenom,
            role: dto.role,
          },
        });

      if (adminErr || !adminCreated.user) {
        this.logger.error(`Erreur création Supabase Admin: ${adminErr?.message}`);
        throw new BadRequestException(
          adminErr?.message || 'Échec de la création du compte dans le service d’authentification.',
        );
      }
      supabaseUid = adminCreated.user.id;
    } else {
      // Inscription standard envoyant un e-mail de confirmation
      const emailRedirectTo = this.resolveEmailRedirectTo(dto.emailRedirectTo);
      const { data: signedUp, error: signUpErr } = await publicClient.auth.signUp({
        email: dto.email,
        password: dto.password,
        options: {
          emailRedirectTo,
          data: {
            nom: dto.nom,
            prenom: dto.prenom,
            role: dto.role,
          },
        },
      });

      if (signUpErr || !signedUp.user) {
        this.logger.error(`Erreur création Supabase SignUp: ${signUpErr?.message}`);
        throw new BadRequestException(
          signUpErr?.message || 'Échec de l’inscription dans le service d’authentification.',
        );
      }
      supabaseUid = signedUp.user.id;
      signUpSession = signedUp.session ?? null;
    }

    // Règle métier : les bénéficiaires sont actifs immédiatement s'ils sont confirmés,
    // les mentors, experts et partenaires sont soumis à validation administrative (statut PENDING)
    const statutCompte =
      dto.role === UserRole.BENEFICIAIRE
        ? AccountStatus.ACTIVE
        : AccountStatus.PENDING;

    const situationHandicap =
      dto.situationHandicap !== undefined
        ? dto.situationHandicap
        : dto.sdh !== undefined
          ? dto.sdh
          : false;

    const newUserId = randomUUID();
    let uploadedCvPath: string | null = null;

    if (cvBuffer) {
      const storagePath = `cvs/${newUserId}/cv-${Date.now()}.pdf`;
      try {
        uploadedCvPath = await this.supabaseService.uploadPrivateFile(
          CV_STORAGE_BUCKET,
          storagePath,
          cvBuffer,
          'application/pdf',
        );
      } catch (uploadErr) {
        try {
          await adminClient.auth.admin.deleteUser(supabaseUid);
        } catch (rollbackError) {
          const errMsg =
            rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
          this.logger.error(`Échec rollback Supabase Auth (${supabaseUid}): ${errMsg}`);
        }
        throw uploadErr;
      }
    }

    // Création transactionnelle dans la base de données locale (avec rollback Supabase Auth & Storage en cas d'échec)
    let user: Awaited<ReturnType<typeof this.prisma.user.create>> & {
      profile?: unknown;
      mentorProfile?: unknown;
    };
    try {
      user = await this.prisma.user.create({
        data: {
          id: newUserId,
          supabaseUid,
          email: dto.email,
          nom: dto.nom,
          prenom: dto.prenom,
          age: dto.age,
          sexe: dto.sexe,
          milieuResidence: dto.milieuResidence,
          situationHandicap,
          telephone: dto.telephone,
          pays: dto.pays,
          role: dto.role,
          statutCompte,
          langue: dto.langue || 'fr',
          consentCgu: dto.consentCgu,
          consentData: dto.consentData,
          profile: {
            create: {
              anneesExperience: isMentorOrExpert ? (dto.anneesExperience ?? 1) : 0,
              secteurActivite:
                isMentorOrExpert && dto.secteurs?.length ? dto.secteurs[0] : null,
              competences: isMentorOrExpert ? (dto.expertises ?? []) : [],
              centresInteret: [],
              objectifs: [],
              langues: [dto.langue || 'fr'],
              disponibilite: isMentorOrExpert ? (dto.disponibilites ?? null) : null,
            },
          },
          // Si mentor ou expert, on initialise également son profil mentor en attente
          ...(isMentorOrExpert
            ? {
              mentorProfile: {
                create: {
                  fonction: dto.fonction?.trim() || 'En attente de renseignement',
                  organisation: dto.organisation?.trim() || 'Non renseigné',
                  anneesExperience: dto.anneesExperience ?? 0,
                  expertises: dto.expertises ?? [],
                  secteurs: dto.secteurs ?? [],
                  langues: ['Français'],
                  publicsAccompagnes: [],
                  typesMentoring: dto.typesMentoring ?? MentorshipType.INDIVIDUEL,
                  disponibilites: dto.disponibilites?.trim() || null,
                  biographie:
                    dto.biographie?.trim() || 'Profil mentor en cours de complétion.',
                  cvUrl: uploadedCvPath,
                  linkedinUrl: dto.linkedinUrl?.trim() || null,
                  references: dto.references?.trim() || null,
                  statutValidation: AccountStatus.PENDING,
                  isAvailable: false,
                },
              },
            }
            : {}),
        },
        include: {
          profile: true,
          mentorProfile: true,
        },
      });
    } catch (error) {
      if (uploadedCvPath) {
        await this.supabaseService.removeFile(CV_STORAGE_BUCKET, uploadedCvPath);
      }
      try {
        await adminClient.auth.admin.deleteUser(supabaseUid);
      } catch (rollbackError) {
        const errMsg = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
        this.logger.error(`Échec rollback Supabase Auth (${supabaseUid}): ${errMsg}`);
      }
      throw error;
    }

    // Si le compte est confirmé, on connecte l'utilisateur pour lui renvoyer directement sa session
    if (autoConfirmed) {
      const { data: loginData } = await publicClient.auth.signInWithPassword({
        email: dto.email,
        password: dto.password,
      });

      return {
        message: 'Inscription réussie.',
        redirectUrl: this.getRedirectUrl(user),
        dashboardUrl: this.getDashboardUrl(user.role),
        user,
        session: loginData?.session
          ? {
            accessToken: loginData.session.access_token,
            refreshToken: loginData.session.refresh_token,
            expiresIn: loginData.session.expires_in,
            expiresAt: loginData.session.expires_at,
            tokenType: loginData.session.token_type,
          }
          : null,
      };
    }

    return {
      message:
        'Inscription réussie. Un e-mail de confirmation vous a été envoyé pour activer votre compte.',
      redirectUrl: this.getRedirectUrl(user),
      dashboardUrl: this.getDashboardUrl(user.role),
      user,
      session: signUpSession
        ? {
          accessToken: signUpSession.access_token,
          refreshToken: signUpSession.refresh_token,
          expiresIn: signUpSession.expires_in,
          expiresAt: signUpSession.expires_at,
          tokenType: signUpSession.token_type,
        }
        : null,
    };
  }

  /**
   * F01 - Connexion (auth/login)
   */
  async login(dto: LoginDto) {
    const publicClient = this.supabaseService.getClient();

    const { data, error } = await publicClient.auth.signInWithPassword({
      email: dto.email,
      password: dto.password,
    });

    if (error || !data.session || !data.user) {
      throw new UnauthorizedException(
        'Identifiants de connexion invalides ou adresse e-mail non encore confirmée.',
      );
    }

    // Récupérer l'utilisateur dans PostgreSQL
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ supabaseUid: data.user.id }, { email: dto.email }],
      },
      include: {
        profile: true,
        mentorProfile: true,
        diagnostic: true,
      },
    });

    if (!user) {
      throw new NotFoundException(
        'Compte local introuvable. Veuillez synchroniser votre compte via /auth/sync.',
      );
    }

    if (user.statutCompte === AccountStatus.SUSPENDED) {
      throw new ForbiddenException('Votre compte a été suspendu par l’administration.');
    }

    if (user.statutCompte === AccountStatus.REJECTED) {
      throw new ForbiddenException('Votre candidature a été refusée par l’administration.');
    }

    return {
      message: 'Connexion réussie.',
      redirectUrl: this.getRedirectUrl(user),
      dashboardUrl: this.getDashboardUrl(user.role),
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresIn: data.session.expires_in,
        expiresAt: data.session.expires_at,
        tokenType: data.session.token_type,
      },
      user,
    };
  }

  /**
   * F01 - Rafraîchissement de jeton de session (auth/refresh)
   */
  async refresh(dto: RefreshTokenDto) {
    const publicClient = this.supabaseService.getClient();

    const { data, error } = await publicClient.auth.refreshSession({
      refresh_token: dto.refreshToken,
    });

    if (error || !data.session || !data.user) {
      throw new UnauthorizedException(
        'Jeton de rafraîchissement invalide ou expiré. Veuillez vous reconnecter.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { supabaseUid: data.user.id },
      include: {
        profile: true,
        mentorProfile: true,
        diagnostic: true,
      },
    });

    return {
      message: 'Jeton actualisé avec succès.',
      redirectUrl: user ? this.getRedirectUrl(user) : '/login',
      dashboardUrl: user ? this.getDashboardUrl(user.role) : '/dashboard',
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresIn: data.session.expires_in,
        expiresAt: data.session.expires_at,
        tokenType: data.session.token_type,
      },
      user,
    };
  }

  /**
   * F01 - Déconnexion (auth/logout)
   */
  async logout(accessToken?: string) {
    if (accessToken) {
      try {
        const adminClient = this.supabaseService.getAdminClient();
        const { error } = await adminClient.auth.admin.signOut(accessToken);
        if (error) {
          this.logger.warn(`Erreur lors de la révocation de session Supabase: ${error.message}`);
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Exception lors de la déconnexion Supabase: ${errMsg}`);
      }
    }
    return { message: 'Déconnexion réussie.' };
  }

  /**
   * F01 - Mot de passe oublié (auth/forgot-password)
   */
  async forgotPassword(dto: ForgotPasswordDto) {
    const publicClient = this.supabaseService.getClient();

    const { error } = await publicClient.auth.resetPasswordForEmail(dto.email, {
      redirectTo: dto.redirectTo,
    });

    if (error) {
      this.logger.warn(`Erreur reset password pour ${dto.email}: ${error.message}`);
    }

    return {
      message:
        'Si un compte est associé à cette adresse e-mail, un lien de réinitialisation vous a été envoyé.',
    };
  }

  /**
   * F01 - Réinitialisation de mot de passe (auth/reset-password)
   */
  async resetPassword(currentUser: any, dto: ResetPasswordDto) {
    const adminClient = this.supabaseService.getAdminClient();
    const supabaseUid = currentUser.supabaseUid;

    if (!supabaseUid) {
      throw new UnauthorizedException('Utilisateur non authentifié.');
    }

    const { error } = await adminClient.auth.admin.updateUserById(supabaseUid, {
      password: dto.newPassword,
    });

    if (error) {
      throw new BadRequestException(
        error.message || 'Impossible de mettre à jour le mot de passe.',
      );
    }

    return { message: 'Votre mot de passe a été réinitialisé avec succès.' };
  }

  /**
   * F01 - Vérification de code OTP (auth/verify-otp)
   */
  async verifyOtp(dto: VerifyOtpDto) {
    const publicClient = this.supabaseService.getClient();

    let data: { user: any; session: any };
    let error: { message?: string } | null = null;

    if (dto.tokenHash) {
      const res = await publicClient.auth.verifyOtp({
        token_hash: dto.tokenHash,
        type: (dto.type as any) || 'recovery',
      });
      data = res.data;
      error = res.error;
    } else if (dto.email && dto.token) {
      const res = await publicClient.auth.verifyOtp({
        email: dto.email,
        token: dto.token,
        type: (dto.type as any) || 'signup',
      });
      data = res.data;
      error = res.error;
    } else {
      throw new BadRequestException(
        'Veuillez fournir tokenHash ou un couple email et code OTP.',
      );
    }

    if (error || !data?.user) {
      throw new BadRequestException(error?.message || 'Code OTP invalide ou expiré.');
    }

    // Activer l'utilisateur bénéficiaire s'il était en attente (mentors/experts/partenaires restent PENDING pour validation admin)
    const whereClauses: Array<Record<string, unknown>> = [{ supabaseUid: data.user.id }];
    if (dto.email) {
      whereClauses.push({ email: dto.email });
    } else if (data.user.email) {
      whereClauses.push({ email: data.user.email });
    }

    let user = await this.prisma.user.findFirst({
      where: {
        OR: whereClauses,
      },
      include: {
        profile: true,
        mentorProfile: true,
        diagnostic: true,
      },
    });

    if (
      user &&
      user.role === UserRole.BENEFICIAIRE &&
      user.statutCompte === AccountStatus.PENDING
    ) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { statutCompte: AccountStatus.ACTIVE },
        include: {
          profile: true,
          mentorProfile: true,
          diagnostic: true,
        },
      });
    }

    return {
      message: 'Vérification réussie.',
      redirectUrl: user ? this.getRedirectUrl(user) : '/login',
      dashboardUrl: user ? this.getDashboardUrl(user.role) : '/dashboard',
      session: data.session
        ? {
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
          expiresIn: data.session.expires_in,
          expiresAt: data.session.expires_at,
          tokenType: data.session.token_type,
        }
        : null,
      user,
    };
  }

  /**
   * Synchronisation manuelle d'un utilisateur Supabase déjà connecté
   */
  async syncUser(currentUser: any, dto: SyncUserDto) {
    if (dto.role === UserRole.ADMIN) {
      throw new ForbiddenException(
        'La création d’un compte administrateur n’est pas autorisée via cette route.',
      );
    }

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

    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ supabaseUid }, { email }],
      },
    });

    if (existingUser) {
      throw new ConflictException('Un compte existe déjà pour cet utilisateur.');
    }

    const statutCompte =
      dto.role === UserRole.BENEFICIAIRE
        ? AccountStatus.ACTIVE
        : AccountStatus.PENDING;

    const situationHandicap =
      dto.situationHandicap !== undefined
        ? dto.situationHandicap
        : dto.sdh !== undefined
          ? dto.sdh
          : false;

    const user = await this.prisma.user.create({
      data: {
        supabaseUid,
        email,
        nom: dto.nom,
        prenom: dto.prenom,
        age: dto.age,
        sexe: dto.sexe,
        milieuResidence: dto.milieuResidence,
        situationHandicap,
        telephone: dto.telephone,
        pays: dto.pays,
        role: dto.role,
        statutCompte,
        langue: dto.langue || 'fr',
        consentCgu: dto.consentCgu,
        consentData: dto.consentData,
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
   * Consultation de son propre profil (auth/me)
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

    return {
      ...user,
      redirectUrl: this.getRedirectUrl(user),
      dashboardUrl: this.getDashboardUrl(user.role),
    };
  }
}
