import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { AdminService } from './admin.service.js';
import { CreateReportDto } from './dto/create-report.dto.js';

@ApiTags('Administration')
@ApiBearerAuth('JWT-auth')
@Controller('reports')
export class ReportsController {
  constructor(private readonly adminService: AdminService) {}

  @Post()
  @ApiOperation({ summary: 'F16 - Soumettre un signalement de contenu ou comportement' })
  async createReport(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateReportDto,
  ) {
    return this.adminService.createReport(userId, dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'F16 - Lister les signalements que j’ai soumis' })
  async getMyReports(@CurrentUser('id') userId: string) {
    return this.adminService.getMyReports(userId);
  }
}
