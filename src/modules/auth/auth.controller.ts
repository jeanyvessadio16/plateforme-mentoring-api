import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { SyncUserDto } from './dto/sync-user.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';

@ApiTags('Authentification')
@ApiBearerAuth('JWT-auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('sync')
  @ApiOperation({
    summary: 'Synchronisation du profil après inscription Supabase',
    description:
      'Associe l’identité Supabase avec la base PostgreSQL locale, enregistre les consentements et initialise le profil.',
  })
  @ApiResponse({ status: 201, description: 'Utilisateur synchronisé avec succès.' })
  @ApiResponse({ status: 409, description: 'Un compte existe déjà pour cet utilisateur.' })
  async syncUser(@CurrentUser() user: any, @Body() dto: SyncUserDto) {
    return this.authService.syncUser(user, dto);
  }

  @Get('me')
  @ApiOperation({
    summary: 'Récupération de la session et des données de l’utilisateur connecté',
  })
  @ApiResponse({ status: 200, description: 'Données utilisateur complètes.' })
  async getMe(@CurrentUser('id') userId: string) {
    return this.authService.getMe(userId);
  }
}
