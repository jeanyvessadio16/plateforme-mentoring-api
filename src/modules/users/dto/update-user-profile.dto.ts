import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateUserProfileDto {
  @ApiPropertyOptional({ description: 'Nom de famille' })
  @IsString()
  @IsOptional()
  nom?: string;

  @ApiPropertyOptional({ description: 'Prénom' })
  @IsString()
  @IsOptional()
  prenom?: string;

  @ApiPropertyOptional({ description: 'Numéro de téléphone' })
  @IsString()
  @IsOptional()
  telephone?: string;

  @ApiPropertyOptional({ description: 'Pays de résidence' })
  @IsString()
  @IsOptional()
  pays?: string;

  @ApiPropertyOptional({ description: 'URL de la photo de profil' })
  @IsString()
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
