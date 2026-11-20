import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UsersService } from './users.service.js';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto.js';
import { UploadAvatarDto } from './dto/upload-avatar.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';

@ApiTags('Utilisateurs & Profils')
@ApiBearerAuth('JWT-auth')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Consulter mon profil complet' })
  @ApiResponse({ status: 200, description: 'Profil récupéré.' })
  async getMyProfile(@CurrentUser('id') userId: string) {
    return this.usersService.getMyProfile(userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Modifier mon profil utilisateur' })
  @ApiResponse({ status: 200, description: 'Profil mis à jour.' })
  async updateMyProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateUserProfileDto,
  ) {
    return this.usersService.updateProfile(userId, dto);
  }

  @Post('me/avatar')
  @ApiOperation({ summary: 'Téléverser ou remplacer ma photo de profil' })
  @ApiResponse({ status: 201, description: 'Photo de profil mise à jour.' })
  async uploadAvatar(
    @CurrentUser('id') userId: string,
    @Body() dto: UploadAvatarDto,
  ) {
    return this.usersService.uploadAvatar(userId, dto.base64Data);
  }

  @Delete('me/avatar')
  @ApiOperation({ summary: 'Supprimer ma photo de profil' })
  @ApiResponse({ status: 200, description: 'Photo de profil supprimée.' })
  async deleteAvatar(@CurrentUser('id') userId: string) {
    return this.usersService.deleteAvatar(userId);
  }

  @Get('me/export')
  @ApiOperation({ summary: 'Exporter toutes mes données personnelles (RGPD)' })
  @ApiResponse({ status: 200, description: 'Export JSON complet des données utilisateur.' })
  async exportMyData(@CurrentUser('id') userId: string) {
    return this.usersService.exportMyData(userId);
  }

  @Public()
  @Get(':id/public')
  @ApiOperation({ summary: 'Consulter un profil public (si autorisé par l’utilisateur)' })
  @ApiResponse({ status: 200, description: 'Données publiques du profil.' })
  @ApiResponse({ status: 403, description: 'Ce profil est privé.' })
  async getPublicProfile(@Param('id') userId: string) {
    return this.usersService.getPublicProfile(userId);
  }

  @Delete('me')
  @ApiOperation({ summary: 'Supprimer mon compte (RGPD / Droit à l’oubli)' })
  @ApiResponse({ status: 200, description: 'Compte supprimé.' })
  async deleteAccount(@CurrentUser('id') userId: string) {
    return this.usersService.deleteAccount(userId);
  }
}
