import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { MentorshipType } from '../../../generated/prisma/client.js';

export class ApplyMentorDto {
  @ApiProperty({ description: 'Fonction ou poste actuel', example: 'Directrice Financière' })
  @IsString()
  @IsNotEmpty()
  fonction: string;

  @ApiProperty({ description: 'Entreprise ou organisation', example: 'Sonatel' })
  @IsString()
  @IsNotEmpty()
  organisation: string;

  @ApiProperty({ description: 'Années d’expérience professionnelle', example: 8 })
  @IsInt()
  @Min(1)
  anneesExperience: number;

  @ApiProperty({
    description: 'Domaines d’expertises clés',
    type: [String],
    example: ['Finance', 'Levée de fonds', 'Comptabilité'],
  })
  @IsArray()
  @IsString({ each: true })
  expertises: string[];

  @ApiProperty({
    description: 'Secteurs d’activité cibles',
    type: [String],
    example: ['Fintech', 'Agribusiness'],
  })
  @IsArray()
  @IsString({ each: true })
  secteurs: string[];

  @ApiProperty({
    description: 'Langues de travail',
    type: [String],
    example: ['Français', 'Wolof', 'Anglais'],
  })
  @IsArray()
  @IsString({ each: true })
  langues: string[];

  @ApiProperty({
    description: 'Publics accompagnés de préférence',
    type: [String],
    example: ['Femmes entrepreneures', 'Jeunes diplômés'],
  })
  @IsArray()
  @IsString({ each: true })
  publicsAccompagnes: string[];

  @ApiProperty({
    enum: MentorshipType,
    description: 'Type d’accompagnement proposé',
    default: MentorshipType.INDIVIDUEL,
  })
  @IsEnum(MentorshipType)
  typesMentoring: MentorshipType;

  @ApiPropertyOptional({
    description: 'Disponibilités estimées (ex: 2h par mois, samedis matins)',
    example: '2 heures par mois',
  })
  @IsString()
  @IsOptional()
  disponibilites?: string;

  @ApiProperty({
    description: 'Courte biographie ou présentation de votre parcours',
    example: 'Passionnée par l’accompagnement des jeunes porteurs de projet en Afrique de l’Ouest...',
  })
  @IsString()
  @IsNotEmpty()
  biographie: string;

  @ApiPropertyOptional({ description: 'URL de la photo de profil' })
  @IsString()
  @IsOptional()
  photoUrl?: string;

  @ApiPropertyOptional({ description: 'URL du CV ou document justificatif' })
  @IsString()
  @IsOptional()
  cvUrl?: string;

  @ApiPropertyOptional({ description: 'Références professionnelles ou liens LinkedIn' })
  @IsString()
  @IsOptional()
  references?: string;
}
