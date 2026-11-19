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
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../generated/prisma/client.js';
import { OpportunitiesService } from './opportunities.service.js';
import { CreateOpportunityDto } from './dto/create-opportunity.dto.js';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto.js';
import { FilterOpportunitiesDto } from './dto/filter-opportunities.dto.js';

@ApiTags('Opportunités')
@ApiBearerAuth('JWT-auth')
@Controller('opportunities')
export class OpportunitiesController {
  constructor(private readonly opportunitiesService: OpportunitiesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'F12 - Catalogue filtrable des opportunités actives' })
  async findAll(@Query() filter: FilterOpportunitiesDto) {
    return this.opportunitiesService.findAll(filter);
  }

  @Get('me/favorites')
  @ApiOperation({ summary: 'F12 - Lister mes opportunités favorites' })
  async getMyFavorites(@CurrentUser('id') userId: string) {
    return this.opportunitiesService.getMyFavorites(userId);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'F12 - Consulter le détail d’une opportunité' })
  async findById(@Param('id') id: string) {
    return this.opportunitiesService.findById(id);
  }

  @Post(':id/favorite')
  @ApiOperation({ summary: 'F12 - Ajouter une opportunité à mes favoris' })
  async addFavorite(
    @Param('id') opportunityId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.opportunitiesService.addFavorite(opportunityId, userId);
  }

  @Delete(':id/favorite')
  @ApiOperation({ summary: 'F12 - Retirer une opportunité de mes favoris' })
  async removeFavorite(
    @Param('id') opportunityId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.opportunitiesService.removeFavorite(opportunityId, userId);
  }

  @Roles(UserRole.ADMIN, UserRole.PARTENAIRE)
  @Post()
  @ApiOperation({ summary: 'F12 - Publier une opportunité (Admin / Partenaire)' })
  async create(@Body() dto: CreateOpportunityDto) {
    return this.opportunitiesService.create(dto);
  }

  @Roles(UserRole.ADMIN, UserRole.PARTENAIRE)
  @Patch(':id')
  @ApiOperation({ summary: 'F12 - Mettre à jour une opportunité (Admin / Partenaire)' })
  async update(@Param('id') id: string, @Body() dto: UpdateOpportunityDto) {
    return this.opportunitiesService.update(id, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.PARTENAIRE)
  @Delete(':id')
  @ApiOperation({ summary: 'F12 - Supprimer une opportunité (Admin / Partenaire)' })
  async remove(@Param('id') id: string) {
    return this.opportunitiesService.remove(id);
  }
}
