import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { UserRole } from '../../../generated/prisma/client.js';

export class SyncUserDto {
  @ApiProperty({ description: 'Nom de famille de l’utilisateur', example: 'Diop' })
  @IsString()
  @IsNotEmpty()
  nom: string;

  @ApiProperty({ description: 'Prénom de l’utilisateur', example: 'Fatou' })
  @IsString()
  @IsNotEmpty()
  prenom: string;

  @ApiPropertyOptional({ description: 'Numéro de téléphone', example: '+221770000000' })
  @IsString()
  @IsOptional()
  telephone?: string;

  @ApiProperty({ description: 'Pays de résidence', example: 'Sénégal' })
  @IsString()
  @IsNotEmpty()
  pays: string;

  @ApiProperty({
    enum: UserRole,
    description: 'Type de compte / rôle souhaité',
    example: UserRole.BENEFICIAIRE,
  })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiPropertyOptional({ description: 'Langue de préférence', default: 'fr', example: 'fr' })
  @IsString()
  @IsOptional()
  langue?: string;

  @ApiProperty({ description: 'Acceptation des Conditions Générales d’Utilisation', example: true })
  @IsBoolean()
  consentCgu: boolean;

  @ApiProperty({
    description: 'Consentement pour le traitement des données personnelles (RGPD)',
    example: true,
  })
  @IsBoolean()
  consentData: boolean;
}
