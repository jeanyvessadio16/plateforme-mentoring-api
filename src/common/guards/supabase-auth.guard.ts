import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { ALLOW_UNREGISTERED_KEY } from '../decorators/allow-unregistered.decorator.js';
import { PrismaService } from '../../core/database/prisma.service.js';
import { AccountStatus } from '../../generated/prisma/client.js';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(SupabaseAuthGuard.name);
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const jwksUrl = this.configService.get<string>('SUPABASE_JWKS_URL');
    if (jwksUrl) {
      try {
        this.jwks = createRemoteJWKSet(new URL(jwksUrl));
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Impossible d'initialiser le JWKS Supabase: ${errMsg}`);
      }
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Jeton d’authentification manquant.');
    }

    if (!this.jwks) {
      const jwksUrl = this.configService.get<string>('SUPABASE_JWKS_URL');
      if (!jwksUrl) {
        throw new UnauthorizedException('Configuration SUPABASE_JWKS_URL manquante.');
      }
      this.jwks = createRemoteJWKSet(new URL(jwksUrl));
    }

    let payload: any;
    try {
      const result = await jwtVerify(token, this.jwks);
      payload = result.payload;
    } catch (err: any) {
      this.logger.warn(`Échec de validation JWT: ${err.message}`);
      throw new UnauthorizedException('Jeton d’authentification invalide ou expiré.');
    }

    request.accessToken = token;

    const supabaseUid = payload.sub;
    if (!supabaseUid) {
      throw new UnauthorizedException('Identifiant utilisateur manquant dans le jeton.');
    }

    // Récupération de l'utilisateur en base de données
    const user = await this.prisma.user.findUnique({
      where: { supabaseUid },
      include: {
        profile: true,
        mentorProfile: true,
      },
    });

    if (!user) {
      const allowUnregistered = this.reflector.getAllAndOverride<boolean>(
        ALLOW_UNREGISTERED_KEY,
        [context.getHandler(), context.getClass()],
      );

      if (!allowUnregistered) {
        throw new UnauthorizedException(
          'Compte utilisateur local introuvable. Veuillez synchroniser votre profil via /auth/sync.',
        );
      }

      // Routes explicitement autorisées sans profil local (ex: /auth/sync, /auth/logout)
      request.user = {
        supabaseUid,
        email: payload.email,
        isRegistered: false,
      };
      request.authPayload = payload;
      return true;
    }

    if (user.statutCompte === AccountStatus.SUSPENDED) {
      throw new ForbiddenException('Votre compte a été suspendu par l’administration.');
    }

    if (user.statutCompte === AccountStatus.REJECTED) {
      throw new ForbiddenException('Votre candidature a été refusée par l’administration.');
    }

    request.user = {
      ...user,
      isRegistered: true,
    };
    request.authPayload = payload;

    return true;
  }

  private extractTokenFromHeader(request: any): string | null {
    const authorization = request.headers?.authorization;
    if (!authorization) {
      return null;
    }
    const [type, token] = authorization.split(' ');
    return type === 'Bearer' ? token : null;
  }
}
