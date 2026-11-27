import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { RequireActiveAccount } from '../../common/decorators/require-active-account.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { AccountStatus, UserRole } from '../../generated/prisma/client.js';
import { MasterclassesService } from './masterclasses.service.js';
import { CreateMasterclassDto } from './dto/create-masterclass.dto.js';
import { UpdateMasterclassDto } from './dto/update-masterclass.dto.js';
import { FilterMasterclassesDto } from './dto/filter-masterclasses.dto.js';
import { MarkAttendanceDto } from './dto/mark-attendance.dto.js';

@ApiTags('Masterclasses')
@ApiBearerAuth('JWT-auth')
@Controller('masterclasses')
export class MasterclassesController {
  constructor(private readonly masterclassesService: MasterclassesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'F11 - Catalogue public des masterclasses (sans liens privés)' })
  async findPublic(@Query() filter: FilterMasterclassesDto) {
    return this.masterclassesService.findPublicMasterclasses(filter);
  }

  @Get('me/registrations')
  @ApiOperation({ summary: 'F11 - Lister mes inscriptions aux masterclasses' })
  async getMyRegistrations(@CurrentUser('id') userId: string) {
    return this.masterclassesService.getMyRegistrations(userId);
  }

  @Roles(UserRole.ADMIN, UserRole.EXPERT)
  @Get('me/created')
  @ApiOperation({
    summary: 'F11 - Lister les masterclasses gérées par l’expert connecté (ou toutes pour Admin)',
  })
  async getManagedMasterclasses(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.masterclassesService.findManaged(userId, userRole);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'F11 - Détail public d’une masterclass (sans liens live/replay)' })
  async getPublicById(@Param('id') id: string) {
    return this.masterclassesService.getPublicMasterclassById(id);
  }

  @Get(':id/access')
  @ApiOperation({ summary: 'F11 - Obtenir les liens live/replay (réservé aux inscrits / experts validés / admin)' })
  async getAccessLinks(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @CurrentUser('statutCompte') statutCompte: AccountStatus,
  ) {
    return this.masterclassesService.getAccessLinks(id, userId, userRole, statutCompte);
  }

  @Post(':id/register')
  @ApiOperation({ summary: 'F11 - S’inscrire à une masterclass' })
  async register(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.masterclassesService.register(id, userId);
  }

  @Delete(':id/register')
  @ApiOperation({ summary: 'F11 - Se désinscrire d’une masterclass' })
  async unregister(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.masterclassesService.unregister(id, userId);
  }

  @Roles(UserRole.ADMIN, UserRole.EXPERT)
  @RequireActiveAccount()
  @Post()
  @ApiOperation({ summary: 'F11 - Créer une masterclass (Admin / Expert validé)' })
  async create(
    @Body() dto: CreateMasterclassDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.masterclassesService.create(dto, userId);
  }

  @Roles(UserRole.ADMIN, UserRole.EXPERT)
  @RequireActiveAccount()
  @Patch(':id')
  @ApiOperation({ summary: 'F11 - Mettre à jour une masterclass (Admin / Expert propriétaire)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMasterclassDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.masterclassesService.update(id, dto, {
      id: userId,
      role: userRole,
    });
  }

  @Roles(UserRole.ADMIN, UserRole.EXPERT)
  @RequireActiveAccount()
  @Delete(':id')
  @ApiOperation({ summary: 'F11 - Supprimer une masterclass (Admin / Expert propriétaire)' })
  async remove(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.masterclassesService.remove(id, {
      id: userId,
      role: userRole,
    });
  }

  @Roles(UserRole.ADMIN, UserRole.EXPERT)
  @RequireActiveAccount()
  @Get(':id/registrations')
  @ApiOperation({ summary: 'F11 - Lister les participants inscrits (Admin / Expert propriétaire)' })
  async listRegistrations(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.masterclassesService.listRegistrations(id, {
      id: userId,
      role: userRole,
    });
  }

  @Roles(UserRole.ADMIN, UserRole.EXPERT)
  @RequireActiveAccount()
  @Patch(':id/registrations/:userId/attendance')
  @ApiOperation({ summary: 'F11 - Marquer la présence d’un participant (Admin / Expert propriétaire)' })
  async markAttendance(
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @Body() dto: MarkAttendanceDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.masterclassesService.markAttendance(
      id,
      targetUserId,
      dto.attended,
      { id: userId, role: userRole },
    );
  }
}
