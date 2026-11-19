import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../generated/prisma/client.js';
import { DashboardsService } from './dashboards.service.js';

@ApiTags('Tableaux de Bord')
@ApiBearerAuth('JWT-auth')
@Controller('dashboards')
export class DashboardsController {
  constructor(private readonly dashboardsService: DashboardsService) {}

  @Public()
  @Get('public-stats')
  @ApiOperation({ summary: 'Statistiques agrégées publiques de la plateforme' })
  async getPublicStats() {
    return this.dashboardsService.getPublicStats();
  }

  @Roles(UserRole.BENEFICIAIRE, UserRole.ADMIN)
  @Get('beneficiary')
  @ApiOperation({ summary: 'F13 - Tableau de bord complet du bénéficiaire' })
  async getBeneficiaryDashboard(@CurrentUser('id') userId: string) {
    return this.dashboardsService.getBeneficiaryDashboard(userId);
  }

  @Roles(UserRole.MENTOR, UserRole.ADMIN)
  @Get('mentor')
  @ApiOperation({ summary: 'F14 - Tableau de bord complet du mentor' })
  async getMentorDashboard(@CurrentUser('id') userId: string) {
    return this.dashboardsService.getMentorDashboard(userId);
  }

  @Roles(UserRole.EXPERT, UserRole.ADMIN)
  @Get('expert')
  @ApiOperation({ summary: 'Tableau de bord de l’expert / intervenant' })
  async getExpertDashboard(@CurrentUser('id') userId: string) {
    return this.dashboardsService.getExpertDashboard(userId);
  }

  @Roles(UserRole.PARTENAIRE, UserRole.ADMIN)
  @Get('partner')
  @ApiOperation({ summary: 'Tableau de bord du partenaire' })
  async getPartnerDashboard(@CurrentUser('id') userId: string) {
    return this.dashboardsService.getPartnerDashboard(userId);
  }
}
