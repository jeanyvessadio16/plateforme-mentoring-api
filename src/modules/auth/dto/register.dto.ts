import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { MilieuResidence, Sexe, UserRole } from '../../../generated/prisma/client.js';

const PUBLIC_REGISTER_ROLES = [
  UserRole.BENEFICIAIRE,
  UserRole.MENTOR,
  UserRole.EXPERT,
  UserRole.PARTENAIRE,
] as const;

export class RegisterDto {
  @ApiProperty({ description: 'Adresse e-mail unique', example: 'fatou.diop@example.com' })
  @IsEmail({}, { message: 'Format d’adresse e-mail invalide.' })
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Mot de passe sécurisé (au moins 8 caractères)',
    example: 'MotDePasse123!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères.' })
  @IsNotEmpty()
  password: string;

  @ApiProperty({ description: 'Nom de famille', example: 'Diop' })
  @IsString()
  @IsNotEmpty()
  nom: string;

  @ApiProperty({ description: 'Prénom', example: 'Fatou' })
  @IsString()
  @IsNotEmpty()
  prenom: string;

  @ApiPropertyOptional({ description: 'Âge de l’utilisateur', example: 24 })
  @IsInt({ message: 'L’âge doit être un nombre entier.' })
  @Min(14, { message: 'L’âge minimum est de 14 ans.' })
  @Max(120, { message: 'L’âge maximum est de 120 ans.' })
  @IsOptional()
  age?: number;

  @ApiPropertyOptional({
    enum: Sexe,
    description: 'Sexe de l’utilisateur (Femme ou Homme)',
    example: Sexe.FEMME,
  })
  @IsEnum(Sexe, { message: 'Le sexe doit être FEMME ou HOMME.' })
  @IsOptional()
  sexe?: Sexe;

  @ApiPropertyOptional({
    enum: MilieuResidence,
    description: 'Milieu de résidence (Rural ou Urbain)',
    example: MilieuResidence.URBAIN,
  })
  @IsEnum(MilieuResidence, { message: 'Le milieu de résidence doit être RURAL ou URBAIN.' })
  @IsOptional()
  milieuResidence?: MilieuResidence;

  @ApiPropertyOptional({
    description: 'Situation de Handicap (SDH : Oui = true, Non = false)',
    default: false,
    example: false,
  })
  @IsBoolean({ message: 'La situation de handicap doit être un booléen (true/false).' })
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
    description: 'Consentement au traitement des données personnelles (RGPD)',
    example: true,
  })
  @IsBoolean()
  consentData: boolean;
}
