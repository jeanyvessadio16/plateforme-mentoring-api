import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';
import { MasterclassStatus } from '../../../generated/prisma/client.js';

export class UpdateMasterclassDto {
  @ApiPropertyOptional()
  @IsString()
  @MaxLength(200)
  @IsOptional()
  titre?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(150)
  @IsOptional()
  intervenant?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(3000)
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(100)
  @IsOptional()
  categorie?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dateSession?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  duree?: number;

  @ApiPropertyOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @IsOptional()
  lienLive?: string;

  @ApiPropertyOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @IsOptional()
  lienReplay?: string;

  @ApiPropertyOptional({ enum: MasterclassStatus })
  @IsEnum(MasterclassStatus)
  @IsOptional()
  statut?: MasterclassStatus;

  @ApiPropertyOptional({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  maxParticipants?: number;
}
