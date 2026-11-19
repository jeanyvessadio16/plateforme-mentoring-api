import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
} from 'class-validator';
import { MilieuResidence, Sexe } from '../../../generated/prisma/client.js';

export class UpdateUserProfileDto {
  @ApiPropertyOptional({ description: 'Nom de famille' })
  @IsString()
  @IsOptional()
  nom?: string;

  @ApiPropertyOptional({ description: 'Prénom' })
  @IsString()
  @IsOptional()
  prenom?: string;

  @ApiPropertyOptional({ description: 'Âge de l’utilisateur', example: 25 })
  @IsInt()
  @Min(14)
  @Max(120)
  @IsOptional()
  age?: number;

  @ApiPropertyOptional({
    enum: Sexe,
    description: 'Sexe (FEMME ou HOMME)',
    example: Sexe.FEMME,
  })
  @IsEnum(Sexe)
  @IsOptional()
  sexe?: Sexe;

  @ApiPropertyOptional({
    enum: MilieuResidence,
    description: 'Milieu de résidence (RURAL ou URBAIN)',
    example: MilieuResidence.URBAIN,
  })
  @IsEnum(MilieuResidence)
  @IsOptional()
  milieuResidence?: MilieuResidence;

  @ApiPropertyOptional({
    description: 'Situation de Handicap (SDH : Oui = true, Non = false)',
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

  @ApiPropertyOptional({ description: 'Numéro de téléphone' })
  @IsString()
  @IsOptional()
  telephone?: string;

  @ApiPropertyOptional({ description: 'Pays de résidence' })
  @IsString()
  @IsOptional()
  pays?: string;

  @ApiPropertyOptional({ description: 'URL de la photo de profil' })
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'URL de photo invalide (http ou https requis).' },
  )
  @IsOptional()
  photoUrl?: string;

  @ApiPropertyOptional({ description: 'Ville de résidence' })
  @IsString()
  @IsOptional()
  ville?: string;

  @ApiPropertyOptional({ description: 'Localisation précise / quartier' })
  @IsString()
  @IsOptional()
  localisation?: string;

  @ApiPropertyOptional({ description: 'Niveau d’études ou diplôme' })
  @IsString()
  @IsOptional()
  niveauEtude?: string;

  @ApiPropertyOptional({ description: 'Secteur d’activité' })
  @IsString()
  @IsOptional()
  secteurActivite?: string;

  @ApiPropertyOptional({ description: 'Années d’expérience professionnelle' })
  @IsInt()
  @Min(0)
  @IsOptional()
  anneesExperience?: number;

  @ApiPropertyOptional({ description: 'Liste des compétences clés', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  competences?: string[];

  @ApiPropertyOptional({ description: 'Centres d’intérêt', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  centresInteret?: string[];

  @ApiPropertyOptional({ description: 'Objectifs professionnels', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  objectifs?: string[];

  @ApiPropertyOptional({ description: 'Langues parlées', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  langues?: string[];

  @ApiPropertyOptional({ description: 'Disponibilité (ex: temps partiel, soirs)' })
  @IsString()
  @IsOptional()
  disponibilite?: string;

  @ApiPropertyOptional({
    description: 'Rendre le profil visible publiquement (Règle RGPD / Confidentialité)',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;
}
