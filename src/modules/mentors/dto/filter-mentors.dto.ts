import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { MentorshipType } from '../../../generated/prisma/client.js';

export class FilterMentorsDto {
  @ApiPropertyOptional({ description: 'Filtrer par expertise' })
  @IsString()
  @IsOptional()
  expertise?: string;

  @ApiPropertyOptional({ description: 'Filtrer par secteur d’activité' })
  @IsString()
  @IsOptional()
  secteur?: string;

  @ApiPropertyOptional({ description: 'Filtrer par pays' })
  @IsString()
  @IsOptional()
  pays?: string;

  @ApiPropertyOptional({ description: 'Filtrer par ville' })
  @IsString()
  @IsOptional()
  ville?: string;

  @ApiPropertyOptional({ description: 'Filtrer par langue' })
  @IsString()
  @IsOptional()
  langue?: string;

  @ApiPropertyOptional({ enum: MentorshipType, description: 'Type de mentoring' })
  @IsEnum(MentorshipType)
  @IsOptional()
  typesMentoring?: MentorshipType;

  @ApiPropertyOptional({ description: 'Recherche libre (nom, organisation, bio)' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Années d’expérience minimales' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  minExperience?: number;

  @ApiPropertyOptional({ description: 'Filtrer par disponibilité (ex: soir, weekend, flexible)' })
  @IsString()
  @IsOptional()
  disponibilite?: string;

  @ApiPropertyOptional({ description: 'Numéro de page', default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Nombre d’éléments par page', default: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number = 10;
}
