import {
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
import { MatchingService } from './matching.service.js';

@ApiTags('Matching')
@ApiBearerAuth('JWT-auth')
@Controller('matching')
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  @Get('recommendations')
  @ApiOperation({
    summary: 'F05 - Obtenir les recommandations de mentors avec scores détaillés',
  })
  @ApiResponse({
    status: 200,
    description: 'Recommandations calculées pour le bénéficiaire connecté.',
  })
  async getRecommendations(@CurrentUser('id') userId: string) {
    return this.matchingService.getRecommendations(userId);
  }

  @Post('recalculate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'F05 - Recalculer le matching',
  })
  async recalculateMatching(@CurrentUser('id') userId: string) {
    return this.matchingService.computeMatchingForUser(userId);
  }
}
