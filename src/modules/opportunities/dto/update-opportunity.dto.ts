import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { OpportunityCategory, OpportunityStatus } from '../../../generated/prisma/client.js';

export class UpdateOpportunityDto {
  @ApiPropertyOptional()
  @IsString()
  @MaxLength(200)
  @IsOptional()
  titre?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(150)
  @IsOptional()
  organisation?: string;

  @ApiPropertyOptional({ enum: OpportunityCategory })
  @IsEnum(OpportunityCategory)
  @IsOptional()
  categorie?: OpportunityCategory;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(4000)
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(150)
  @IsOptional()
  localisation?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(100)
  @IsOptional()
  typeContrat?: string;

  @ApiPropertyOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @IsOptional()
  lienCandidature?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dateExpiration?: string;

  @ApiPropertyOptional({ enum: OpportunityStatus })
  @IsEnum(OpportunityStatus)
  @IsOptional()
  status?: OpportunityStatus;
}
