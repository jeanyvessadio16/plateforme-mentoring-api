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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../generated/prisma/client.js';
import { SessionsService } from './sessions.service.js';
import { CreateSlotDto } from './dto/create-slot.dto.js';
import { UpdateSlotDto } from './dto/update-slot.dto.js';
import { BookSessionDto } from './dto/book-session.dto.js';
import { RescheduleSessionDto } from './dto/reschedule-session.dto.js';
import { CompleteSessionDto } from './dto/complete-session.dto.js';
import { SessionFeedbackDto } from './dto/session-feedback.dto.js';
import { ListSessionsDto } from './dto/list-sessions.dto.js';

@ApiTags('Agenda & Sessions')
@ApiBearerAuth('JWT-auth')
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  // ==========================================
  // DISPONIBILITÉS (SLOTS) — avant les routes :id
  // ==========================================

  @Roles(UserRole.MENTOR, UserRole.EXPERT, UserRole.ADMIN)
  @Post('slots')
  @ApiOperation({ summary: 'F09 - Créer un créneau de disponibilité mentor/expert' })
  async createSlot(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateSlotDto,
  ) {
    return this.sessionsService.createSlot(userId, dto);
  }

  @Get('slots/me')
  @ApiOperation({ summary: 'F09 - Lister mes créneaux de disponibilité' })
  async getMySlots(@CurrentUser('id') userId: string) {
    return this.sessionsService.getMySlots(userId);
  }

  @Public()
  @Get('slots/mentor/:mentorId')
  @ApiOperation({ summary: 'F09 - Consulter les créneaux disponibles d’un mentor' })
  async getMentorSlots(@Param('mentorId') mentorId: string) {
    return this.sessionsService.getMentorSlots(mentorId);
  }

  @Patch('slots/:slotId')
  @ApiOperation({ summary: 'F09 - Modifier un créneau de disponibilité' })
  async updateSlot(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('slotId') slotId: string,
    @Body() dto: UpdateSlotDto,
  ) {
    return this.sessionsService.updateSlot(userId, userRole, slotId, dto);
  }

  @Delete('slots/:slotId')
  @ApiOperation({ summary: 'F09 - Supprimer un créneau de disponibilité' })
  async deleteSlot(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('slotId') slotId: string,
  ) {
    return this.sessionsService.deleteSlot(userId, userRole, slotId);
  }

  // ==========================================
  // SESSIONS
  // ==========================================

  @Post()
  @ApiOperation({ summary: 'F09 - Réserver une session de mentoring' })
  @ApiResponse({ status: 201, description: 'Session réservée et parties notifiées.' })
  async bookSession(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Body() dto: BookSessionDto,
  ) {
    return this.sessionsService.bookSession(userId, userRole, dto);
  }

  @Get()
  @ApiOperation({ summary: 'F09 - Lister mes sessions de mentoring' })
  async listSessions(
    @CurrentUser('id') userId: string,
    @Query() query: ListSessionsDto,
  ) {
    return this.sessionsService.listSessions(userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'F09 - Consulter le détail d’une session' })
  async getSessionById(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('id') sessionId: string,
  ) {
    return this.sessionsService.getSessionById(userId, userRole, sessionId);
  }

  @Patch(':id/reschedule')
  @ApiOperation({ summary: 'F09 - Reporter une session de mentoring' })
  async rescheduleSession(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('id') sessionId: string,
    @Body() dto: RescheduleSessionDto,
  ) {
    return this.sessionsService.rescheduleSession(userId, userRole, sessionId, dto);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'F09 - Annuler une session et libérer le créneau ponctuel' })
  async cancelSession(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('id') sessionId: string,
  ) {
    return this.sessionsService.cancelSession(userId, userRole, sessionId);
  }

  @Patch(':id/complete')
  @ApiOperation({ summary: 'F09 - Clôturer une session réalisée' })
  async completeSession(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('id') sessionId: string,
    @Body() dto: CompleteSessionDto,
  ) {
    return this.sessionsService.completeSession(userId, userRole, sessionId, dto);
  }

  @Patch(':id/feedback')
  @ApiOperation({ summary: 'F09 - Déposer un retour et une note de satisfaction sur une session' })
  async submitFeedback(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('id') sessionId: string,
    @Body() dto: SessionFeedbackDto,
  ) {
    return this.sessionsService.submitFeedback(userId, userRole, sessionId, dto);
  }
}
