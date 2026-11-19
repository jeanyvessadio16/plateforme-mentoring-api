import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { DiagnosticService } from './diagnostic.service.js';
import { SubmitDiagnosticDto } from './dto/submit-diagnostic.dto.js';

@ApiTags('Diagnostic')
@ApiBearerAuth('JWT-auth')
@Controller('diagnostic')
export class DiagnosticController {
  constructor(private readonly diagnosticService: DiagnosticService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'F04 - Soumettre ou mettre à jour le questionnaire de diagnostic',
    description:
      'Enregistre les réponses du bénéficiaire, valide son profil et calcule automatiquement ses mentors recommandés.',
  })
  @ApiResponse({
    status: 200,
    description: 'Diagnostic enregistré avec succès et recommandations générées.',
  })
  async submitDiagnostic(
    @CurrentUser('id') userId: string,
    @Body() dto: SubmitDiagnosticDto,
  ) {
    return this.diagnosticService.submitDiagnostic(userId, dto);
  }

  @Get('me')
  @ApiOperation({
    summary: 'F04 - Consulter son diagnostic actuel et statut de complétion',
  })
  @ApiResponse({
    status: 200,
    description: 'Diagnostic actuel ou null.',
  })
  async getMyDiagnostic(@CurrentUser('id') userId: string) {
    return this.diagnosticService.getMyDiagnostic(userId);
  }

  @Get('recommendations')
  @ApiOperation({
    summary: 'F05 - Obtenir la liste des mentors recommandés par le moteur de matching',
    description:
      'Renvoie les mentors classés par score de compatibilité décroissant avec détails et justifications.',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des recommandations avec scores de matching.',
  })
  async getRecommendations(@CurrentUser('id') userId: string) {
    return this.diagnosticService.getRecommendations(userId);
  }

  @Post('recalculate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'F05 - Recalculer manuellement le matching avec les derniers mentors inscrits',
  })
  async recalculate(@CurrentUser('id') userId: string) {
    return this.diagnosticService.recalculateMatching(userId);
  }
}
