import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitDiagnosticDto {
  @ApiProperty({
    example: 'PORT_PROJET',
    description: 'Situation actuelle (ETUDIANT, EN_RECHERCHE, RECONVERSION, PORT_PROJET, etc.)',
  })
  @IsString()
  @IsNotEmpty()
  situation: string;

  @ApiProperty({
    example: 'Lancer ma startup EdTech en Afrique de l’Ouest',
    description: 'Objectif prioritaire du bénéficiaire',
  })
  @IsString()
  @IsNotEmpty()
  objectifPrincipal: string;

  @ApiProperty({
    example: 'NUMERIQUE',
    description: 'Grand domaine d’activité (NUMERIQUE, AGRIBUSINESS, ENERGIE, SERVICES, etc.)',
  })
  @IsString()
  @IsNotEmpty()
  domaine: string;

  @ApiProperty({
    example: 'INTERMEDIAIRE',
    description: 'Niveau d’expérience ou de maturité du projet (DEBUTANT, INTERMEDIAIRE, AVANCE)',
  })
  @IsString()
  @IsNotEmpty()
  niveau: string;

  @ApiProperty({
    example: 'INDIVIDUEL',
    description: 'Type d’accompagnement souhaité (INDIVIDUEL, COLLECTIF, LES_DEUX)',
  })
  @IsString()
  @IsNotEmpty()
  typeAccompagnement: string;

  @ApiProperty({
    example: ['React', 'NestJS', 'Gestion de projet', 'Business Model'],
    description: 'Compétences clés à acquérir ou renforcer',
  })
  @IsArray()
  @IsString({ each: true })
  competences: string[];

  @ApiProperty({
    example: ['Recherche de financement', 'Validation produit marché', 'Pitch'],
    description: 'Besoins d’accompagnement identifiés',
  })
  @IsArray()
  @IsString({ each: true })
  besoins: string[];

  @ApiProperty({
    example: 'Technologies de l’Information & Communication',
    description: 'Secteur d’activité précis',
  })
  @IsString()
  @IsNotEmpty()
  secteur: string;

  @ApiPropertyOptional({
    example: ['Connexion internet instable en zone rurale'],
    description: 'Contraintes particulières (matériel, mobilité, etc.)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  contraintes?: string[];

  @ApiProperty({
    example: 'SOIR_ET_WEEKEND',
    description: 'Disponibilités temporelles (SEMAINE, WEEKEND, SOIR, FLEXIBLE)',
  })
  @IsString()
  @IsNotEmpty()
  disponibilite: string;

  @ApiProperty({
    example: 'VIRTUEL',
    description: 'Préférence de format de mentoring (VIRTUEL, PRESENTIEL, HYBRIDE)',
  })
  @IsString()
  @IsNotEmpty()
  preferenceMentoring: string;
}
