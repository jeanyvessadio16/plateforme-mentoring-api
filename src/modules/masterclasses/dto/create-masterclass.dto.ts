import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';
import { MasterclassStatus } from '../../../generated/prisma/client.js';

export class CreateMasterclassDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  titre: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  intervenant: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(3000)
  description: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  categorie: string;

  @ApiProperty({ description: 'Date et heure de la session (ISO 8601)' })
  @IsDateString()
  dateSession: string;

  @ApiProperty({ description: 'Durée en minutes', minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  duree: number;

  @ApiPropertyOptional({ description: 'Lien de diffusion live (http/https)' })
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @IsOptional()
  lienLive?: string;

  @ApiPropertyOptional({ description: 'Lien replay vidéo (http/https)' })
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @IsOptional()
  lienReplay?: string;

  @ApiPropertyOptional({ enum: MasterclassStatus, default: MasterclassStatus.UPCOMING })
  @IsEnum(MasterclassStatus)
  @IsOptional()
  statut?: MasterclassStatus = MasterclassStatus.UPCOMING;

  @ApiPropertyOptional({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  maxParticipants?: number;
}
