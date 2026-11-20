import {
  Body,
  Controller,
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
import { MentorsService } from './mentors.service.js';
import { ApplyMentorDto } from './dto/apply-mentor.dto.js';
import { FilterMentorsDto } from './dto/filter-mentors.dto.js';
import { UpdateAvailabilityDto } from './dto/update-availability.dto.js';
import { UpdateMentorProfileDto } from './dto/update-mentor-profile.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../generated/prisma/client.js';

@ApiTags('Mentors')
@ApiBearerAuth('JWT-auth')
@Controller('mentors')
export class MentorsController {
  constructor(private readonly mentorsService: MentorsService) {}

  @Post('apply')
  @ApiOperation({
    summary: 'Soumettre une candidature pour devenir mentor (F03)',
    description:
      'Enregistre le profil d’expertise, le parcours et soumet le compte à la validation administrative.',
  })
  @ApiResponse({ status: 201, description: 'Candidature enregistrée.' })
  async apply(@CurrentUser('id') userId: string, @Body() dto: ApplyMentorDto) {
    return this.mentorsService.apply(userId, dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Consulter mon profil mentor personnel' })
  @ApiResponse({ status: 200, description: 'Profil mentor récupéré.' })
  async getMyMentorProfile(@CurrentUser('id') userId: string) {
    return this.mentorsService.getMyMentorProfile(userId);
  }

  @Roles(UserRole.MENTOR, UserRole.EXPERT, UserRole.ADMIN)
  @Patch('me')
  @ApiOperation({ summary: 'Mettre à jour mon profil mentor/expert sans réinitialiser la validation' })
  @ApiResponse({ status: 200, description: 'Profil mentor mis à jour.' })
  async updateMyMentorProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateMentorProfileDto,
  ) {
    return this.mentorsService.updateMyMentorProfile(userId, dto);
  }

  @Patch('me/availability')
  @ApiOperation({
    summary: 'Suspendre ou réactiver ma disponibilité de mentor (F03)',
  })
  @ApiResponse({ status: 200, description: 'Disponibilité mise à jour.' })
  async updateAvailability(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateAvailabilityDto,
  ) {
    return this.mentorsService.updateAvailability(userId, dto.isAvailable);
  }

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Recherche et catalogue des mentors validés (F06)',
    description:
      'Permet de filtrer par expertise, secteur, langue, pays, ville ou recherche plein texte.',
  })
  @ApiResponse({ status: 200, description: 'Liste paginée des mentors disponibles.' })
  async findMentors(@Query() query: FilterMentorsDto) {
    return this.mentorsService.findMentors(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Consulter la fiche détaillée d’un mentor' })
  @ApiResponse({ status: 200, description: 'Fiche mentor détaillée.' })
  @ApiResponse({ status: 404, description: 'Mentor introuvable.' })
  async getMentorById(@Param('id') id: string) {
    return this.mentorsService.getMentorById(id);
  }
}
