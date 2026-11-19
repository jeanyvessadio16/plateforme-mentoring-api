import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { MentorshipType } from '../../../generated/prisma/client.js';

export class FilterRecommendationsDto {
  @ApiPropertyOptional({ description: 'Score minimal de correspondance (0-100)' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  minScore?: number;

  @ApiPropertyOptional({ description: 'Filtrer par secteur' })
  @IsString()
  @IsOptional()
  secteur?: string;

  @ApiPropertyOptional({ description: 'Filtrer par langue' })
  @IsString()
  @IsOptional()
  langue?: string;

  @ApiPropertyOptional({ enum: MentorshipType, description: 'Filtrer par format de mentoring' })
  @IsEnum(MentorshipType)
  @IsOptional()
  typesMentoring?: MentorshipType;
}
