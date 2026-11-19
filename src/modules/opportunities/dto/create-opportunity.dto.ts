import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { OpportunityCategory } from '../../../generated/prisma/client.js';

export class CreateOpportunityDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  titre: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  organisation: string;

  @ApiProperty({ enum: OpportunityCategory })
  @IsEnum(OpportunityCategory)
  categorie: OpportunityCategory;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  description: string;

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

  @ApiProperty({ description: 'Lien externe de candidature (http/https uniquement)' })
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @IsNotEmpty()
  lienCandidature: string;

  @ApiProperty({ description: 'Date d’expiration (ISO 8601)' })
  @IsDateString()
  dateExpiration: string;
}
