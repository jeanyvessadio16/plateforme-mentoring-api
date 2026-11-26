import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../generated/prisma/client.js';
import { AdminService } from './admin.service.js';
import { ListAdminUsersDto } from './dto/list-admin-users.dto.js';
import { UpdateUserStatusDto } from './dto/update-user-status.dto.js';
import { UpdateUserRoleDto } from './dto/update-user-role.dto.js';
import { UpdateMatchingWeightsDto } from './dto/update-matching-weights.dto.js';
import { ListReportsDto } from './dto/list-reports.dto.js';
import { UpdateReportDto } from './dto/update-report.dto.js';
import { ExportQueryDto } from './dto/export-query.dto.js';

@ApiTags('Administration')
@ApiBearerAuth('JWT-auth')
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'F16 & F17 - Statistiques complètes et KPIs d’impact' })
  async getStats() {
    return this.adminService.getStats();
  }

  @Get('validations/pending')
  @ApiOperation({ summary: 'F16 - Liste des comptes et mentors en attente avec CV signé' })
  async getPendingValidations() {
    return this.adminService.getPendingValidations();
  }

  @Get('users')
  @ApiOperation({ summary: 'F16 - Lister et filtrer tous les utilisateurs' })
  async listUsers(@Query() filter: ListAdminUsersDto) {
    return this.adminService.listUsers(filter);
  }

  @Post('users/sync')
  @ApiOperation({ summary: 'F16 - Synchroniser les utilisateurs Supabase Auth vers PostgreSQL' })
  async syncAuthUsers() {
    return this.adminService.syncAuthUsers();
  }

  @Patch('users/:id/status')
  @ApiOperation({ summary: 'F16 - Valider, refuser, suspendre ou réactiver un utilisateur/mentor' })
  async updateUserStatus(
    @CurrentUser('id') adminId: string,
    @Param('id') userId: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.adminService.updateUserStatus(adminId, userId, dto);
  }

  @Patch('users/:id/role')
  @ApiOperation({ summary: 'F16 - Modifier le rôle d’un utilisateur' })
  async updateUserRole(
    @Param('id') userId: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.adminService.updateUserRole(userId, dto.role);
  }

  @Delete('users/:id')
  @ApiOperation({
    summary:
      'F16 - Supprimer définitivement un compte utilisateur et tous ses documents (Admin)',
  })
  async deleteUser(
    @CurrentUser('id') adminId: string,
    @Param('id') userId: string,
  ) {
    return this.adminService.deleteUser(adminId, userId);
  }

  @Get('programs')
  @ApiOperation({ summary: 'F16 - Lister tous les parcours de mentoring de la plateforme' })
  async listPrograms(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.listPrograms(
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }

  @Get('sessions')
  @ApiOperation({ summary: 'F16 - Lister toutes les sessions de la plateforme' })
  async listSessions(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.listSessions(
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }

  @Get('activities')
  @ApiOperation({ summary: 'F16 - Journal d’activité récente de la plateforme' })
  async getRecentActivities() {
    return this.adminService.getRecentActivities();
  }

  @Get('matching-weights')
  @ApiOperation({ summary: 'F05 / F16 - Consulter les pondérations du moteur de matching' })
  async getMatchingWeights() {
    return this.adminService.getMatchingWeights();
  }

  @Patch('matching-weights')
  @ApiOperation({ summary: 'F05 / F16 - Configurer les pondérations du moteur de matching' })
  async updateMatchingWeights(
    @CurrentUser('id') adminId: string,
    @Body() dto: UpdateMatchingWeightsDto,
  ) {
    return this.adminService.updateMatchingWeights(adminId, dto);
  }

  @Get('reports')
  @ApiOperation({ summary: 'F16 - Lister les signalements de modération' })
  async listReports(@Query() filter: ListReportsDto) {
    return this.adminService.listReports(filter);
  }

  @Patch('reports/:id')
  @ApiOperation({ summary: 'F16 - Instruire et clôturer un signalement' })
  async updateReport(
    @Param('id') reportId: string,
    @Body() dto: UpdateReportDto,
  ) {
    return this.adminService.updateReport(reportId, dto);
  }

  @Get('exports/users')
  @ApiOperation({ summary: 'F17 - Exporter la liste des utilisateurs (CSV ou Excel)' })
  async exportUsers(@Query() query: ExportQueryDto, @Res() res: Response) {
    const format = query.format ?? 'csv';
    if (format === 'pdf') {
      throw new BadRequestException(
        'Le format PDF est disponible sur /admin/exports/impact ; utilisez csv ou xlsx pour les utilisateurs.',
      );
    }

    const result = await this.adminService.exportUsers(format);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.buffer);
  }

  @Get('exports/impact')
  @ApiOperation({ summary: 'F17 - Exporter le rapport d’impact KPIs (CSV, Excel ou PDF)' })
  async exportImpact(@Query() query: ExportQueryDto, @Res() res: Response) {
    const format = query.format ?? 'csv';
    const result = await this.adminService.exportImpactReport(format);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.buffer);
  }
}
