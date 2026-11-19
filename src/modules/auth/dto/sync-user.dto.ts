import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { MilieuResidence, Sexe, UserRole } from '../../../generated/prisma/client.js';

const PUBLIC_REGISTER_ROLES = [
  UserRole.BENEFICIAIRE,
  UserRole.MENTOR,
  UserRole.EXPERT,
  UserRole.PARTENAIRE,
] as const;

export class SyncUserDto {
  @ApiProperty({ description: 'Nom de famille de l’utilisateur', example: 'Diop' })
  @IsString()
  @IsNotEmpty()
  nom: string;

  @ApiProperty({ description: 'Prénom de l’utilisateur', example: 'Fatou' })
  @IsString()
  @IsNotEmpty()
  prenom: string;

  @ApiPropertyOptional({ description: 'Âge de l’utilisateur', example: 24 })
  @IsInt()
  @Min(14)
  @Max(120)
  @IsOptional()
  age?: number;

  @ApiPropertyOptional({
    enum: Sexe,
    description: 'Sexe (Femme ou Homme)',
    example: Sexe.FEMME,
  })
  @IsEnum(Sexe)
  @IsOptional()
  sexe?: Sexe;

  @ApiPropertyOptional({
    enum: MilieuResidence,
    description: 'Milieu de résidence (Rural ou Urbain)',
    example: MilieuResidence.URBAIN,
  })
  @IsEnum(MilieuResidence)
  @IsOptional()
  milieuResidence?: MilieuResidence;

  @ApiPropertyOptional({
    description: 'Situation de Handicap (SDH : Oui = true, Non = false)',
    default: false,
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  situationHandicap?: boolean;

  @ApiPropertyOptional({
    description: 'Alias pour situationHandicap (SDH)',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  sdh?: boolean;

  @ApiPropertyOptional({ description: 'Numéro de téléphone', example: '+221770000000' })
  @IsString()
  @IsOptional()
  telephone?: string;

  @ApiProperty({ description: 'Pays de résidence', example: 'Sénégal' })
  @IsString()
  @IsNotEmpty()
  pays: string;

  @ApiProperty({
    enum: PUBLIC_REGISTER_ROLES,
    description: 'Type de compte / rôle souhaité',
    example: UserRole.BENEFICIAIRE,
  })
  @IsIn(PUBLIC_REGISTER_ROLES, {
    message: 'Le rôle doit être BENEFICIAIRE, MENTOR, EXPERT ou PARTENAIRE.',
  })
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
