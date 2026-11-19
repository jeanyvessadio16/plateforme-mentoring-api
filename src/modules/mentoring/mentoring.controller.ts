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
import { UserRole } from '../../generated/prisma/client.js';
import { MentoringService } from './mentoring.service.js';
import { CreateMentorshipRequestDto } from './dto/create-mentorship-request.dto.js';
import { RespondMentorshipRequestDto } from './dto/respond-mentorship-request.dto.js';
import { ListRequestsDto } from './dto/list-requests.dto.js';
import { ListProgramsDto } from './dto/list-programs.dto.js';
import { UpdateProgramDto } from './dto/update-program.dto.js';
import { CreateGoalDto } from './dto/create-goal.dto.js';
import { UpdateGoalDto } from './dto/update-goal.dto.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { CreateResourceDto } from './dto/create-resource.dto.js';

@ApiTags('Mentoring')
@ApiBearerAuth('JWT-auth')
@Controller('mentoring')
export class MentoringController {
  constructor(private readonly mentoringService: MentoringService) {}

  @Post('requests')
  @ApiOperation({ summary: 'F07 - Envoyer une demande de mentoring à un mentor actif' })
  @ApiResponse({ status: 201, description: 'Demande de mentoring créée.' })
  async createRequest(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateMentorshipRequestDto,
  ) {
    return this.mentoringService.createRequest(userId, dto);
  }

  @Get('requests')
  @ApiOperation({ summary: 'F07 - Lister mes demandes de mentoring envoyées ou reçues' })
  async listRequests(
    @CurrentUser('id') userId: string,
    @Query() query: ListRequestsDto,
  ) {
    return this.mentoringService.listRequests(userId, query);
  }

  @Get('requests/:id')
  @ApiOperation({ summary: 'F07 - Consulter le détail d’une demande de mentoring' })
  async getRequestById(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('id') requestId: string,
  ) {
    return this.mentoringService.getRequestById(userId, userRole, requestId);
  }

  @Patch('requests/:id/respond')
  @ApiOperation({ summary: 'F07 - Accepter, refuser ou demander des précisions sur une demande' })
  async respondToRequest(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('id') requestId: string,
    @Body() dto: RespondMentorshipRequestDto,
  ) {
    return this.mentoringService.respondToRequest(userId, userRole, requestId, dto);
  }

  @Patch('requests/:id/cancel')
  @ApiOperation({ summary: 'F07 - Annuler une demande de mentoring en attente' })
  async cancelRequest(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('id') requestId: string,
  ) {
    return this.mentoringService.cancelRequest(userId, userRole, requestId);
  }

  @Get('programs')
  @ApiOperation({ summary: 'F08 - Lister mes parcours de mentoring (mentor et mentoré)' })
  async listPrograms(
    @CurrentUser('id') userId: string,
    @Query() query: ListProgramsDto,
  ) {
    return this.mentoringService.listPrograms(userId, query);
  }

  @Get('programs/:id')
  @ApiOperation({ summary: 'F08 - Consulter le détail complet d’un parcours de mentoring' })
  async getProgramById(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('id') programId: string,
  ) {
    return this.mentoringService.getProgramById(userId, userRole, programId);
  }

  @Patch('programs/:id')
  @ApiOperation({ summary: 'F08 - Mettre à jour les informations ou le statut d’un parcours' })
  async updateProgram(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('id') programId: string,
    @Body() dto: UpdateProgramDto,
  ) {
    return this.mentoringService.updateProgram(userId, userRole, programId, dto);
  }

  @Post('programs/:id/goals')
  @ApiOperation({ summary: 'F08 - Ajouter un objectif au parcours' })
  async addGoal(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('id') programId: string,
    @Body() dto: CreateGoalDto,
  ) {
    return this.mentoringService.addGoal(userId, userRole, programId, dto);
  }

  @Patch('programs/:id/goals/:goalId')
  @ApiOperation({ summary: 'F08 - Modifier ou valider un objectif du parcours' })
  async updateGoal(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('id') programId: string,
    @Param('goalId') goalId: string,
    @Body() dto: UpdateGoalDto,
  ) {
    return this.mentoringService.updateGoal(userId, userRole, programId, goalId, dto);
  }

  @Delete('programs/:id/goals/:goalId')
  @ApiOperation({ summary: 'F08 - Supprimer un objectif du parcours' })
  async deleteGoal(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('id') programId: string,
    @Param('goalId') goalId: string,
  ) {
    return this.mentoringService.deleteGoal(userId, userRole, programId, goalId);
  }

  @Post('programs/:id/tasks')
  @ApiOperation({ summary: 'F08 - Ajouter une action/tâche au plan d’accompagnement' })
  async addTask(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('id') programId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.mentoringService.addTask(userId, userRole, programId, dto);
  }

  @Patch('programs/:id/tasks/:taskId')
  @ApiOperation({ summary: 'F08 - Mettre à jour une tâche et recalculer la progression' })
  async updateTask(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('id') programId: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.mentoringService.updateTask(userId, userRole, programId, taskId, dto);
  }

  @Delete('programs/:id/tasks/:taskId')
  @ApiOperation({ summary: 'F08 - Supprimer une tâche du parcours' })
  async deleteTask(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('id') programId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.mentoringService.deleteTask(userId, userRole, programId, taskId);
  }

  @Post('programs/:id/resources')
  @ApiOperation({ summary: 'F08 - Ajouter une ressource pédagogique au parcours' })
  async addResource(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('id') programId: string,
    @Body() dto: CreateResourceDto,
  ) {
    return this.mentoringService.addResource(userId, userRole, programId, dto);
  }

  @Delete('programs/:id/resources/:resourceId')
  @ApiOperation({ summary: 'F08 - Supprimer une ressource pédagogique du parcours' })
  async deleteResource(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('id') programId: string,
    @Param('resourceId') resourceId: string,
  ) {
    return this.mentoringService.deleteResource(userId, userRole, programId, resourceId);
  }
}
