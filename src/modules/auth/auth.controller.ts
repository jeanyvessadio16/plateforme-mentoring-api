import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';
import { SyncUserDto } from './dto/sync-user.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { AllowUnregistered } from '../../common/decorators/allow-unregistered.decorator.js';

@ApiTags('Authentification')
@ApiBearerAuth('JWT-auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  @ApiOperation({
    summary: 'Inscription d’un nouvel utilisateur (F01)',
    description:
      'Crée le compte utilisateur dans Supabase Auth et PostgreSQL avec rôle, profil et validation des consentements CGU/RGPD.',
  })
  @ApiResponse({ status: 201, description: 'Compte créé avec succès (renvoie session et profil).' })
  @ApiResponse({ status: 400, description: 'Données invalides ou consentement manquant.' })
  @ApiResponse({ status: 409, description: 'Un compte existe déjà avec cette adresse e-mail.' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Connexion par e-mail et mot de passe (F01)',
    description:
      'Authentifie l’utilisateur auprès de Supabase et renvoie les jetons d’accès (JWT), de rafraîchissement et le profil.',
  })
  @ApiResponse({ status: 200, description: 'Connexion réussie.' })
  @ApiResponse({ status: 401, description: 'Identifiants invalides ou e-mail non confirmé.' })
  @ApiResponse({ status: 403, description: 'Compte suspendu ou refusé par l’administration.' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rafraîchir les jetons de session (F01)',
    description:
      'Génère un nouveau jeton d’accès JWT valide à partir du jeton de rafraîchissement (refresh token).',
  })
  @ApiResponse({ status: 200, description: 'Nouveau jeton d’accès généré.' })
  @ApiResponse({ status: 401, description: 'Refresh token invalide ou expiré.' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @AllowUnregistered()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Déconnexion de l’utilisateur (F01)',
    description: 'Invalide la session en cours.',
  })
  @ApiResponse({ status: 200, description: 'Déconnexion confirmée.' })
  async logout(@Req() req: any) {
    return this.authService.logout(req.accessToken);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Demande de réinitialisation de mot de passe oublié (F01)',
    description:
      'Envoie un e-mail contenant le lien sécurisé pour redéfinir son mot de passe.',
  })
  @ApiResponse({ status: 200, description: 'E-mail de réinitialisation envoyé si le compte existe.' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Définir un nouveau mot de passe (F01)',
    description:
      'Modifie le mot de passe du compte authentifié (après lien de récupération).',
  })
  @ApiResponse({ status: 200, description: 'Mot de passe mis à jour avec succès.' })
  @ApiResponse({ status: 400, description: 'Mot de passe trop court ou invalide.' })
  async resetPassword(
    @CurrentUser() user: any,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.authService.resetPassword(user, dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Vérifier un code OTP par e-mail ou SMS (F01)',
    description: 'Vérifie le code à 6 chiffres envoyé pour valider l’inscription ou la réinitialisation.',
  })
  @ApiResponse({ status: 200, description: 'Code validé et session activée.' })
  @ApiResponse({ status: 400, description: 'Code invalide ou expiré.' })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @AllowUnregistered()
  @Post('sync')
  @ApiOperation({
    summary: 'Synchronisation du profil après inscription directe côté client',
    description:
      'Permet à un client ayant utilisé le SDK Supabase en frontal de synchroniser son profil local.',
  })
  @ApiResponse({ status: 201, description: 'Profil synchronisé.' })
  async syncUser(@CurrentUser() user: any, @Body() dto: SyncUserDto) {
    return this.authService.syncUser(user, dto);
  }

  @Get('me')
  @ApiOperation({
    summary: 'Consulter la session et les données du compte connecté (F01)',
  })
  @ApiResponse({ status: 200, description: 'Informations utilisateur complètes.' })
  async getMe(@CurrentUser('id') userId: string) {
    return this.authService.getMe(userId);
  }
}
