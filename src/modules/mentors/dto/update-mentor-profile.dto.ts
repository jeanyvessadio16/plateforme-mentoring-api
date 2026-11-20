import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { MentorshipType } from '../../../generated/prisma/client.js';

export class UpdateMentorProfileDto {
  @ApiPropertyOptional({ description: 'Fonction ou poste actuel' })
  @IsString()
  @IsOptional()
  fonction?: string;

  @ApiPropertyOptional({ description: 'Entreprise ou organisation' })
  @IsString()
  @IsOptional()
  organisation?: string;

  @ApiPropertyOptional({ description: 'Années d’expérience professionnelle' })
  @IsInt()
  @Min(0)
  @IsOptional()
  anneesExperience?: number;

  @ApiPropertyOptional({ description: 'Domaines d’expertises clés', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  expertises?: string[];

  @ApiPropertyOptional({ description: 'Secteurs d’activité cibles', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  secteurs?: string[];

  @ApiPropertyOptional({ description: 'Langues de travail', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  langues?: string[];

  @ApiPropertyOptional({ description: 'Publics accompagnés', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  publicsAccompagnes?: string[];

  @ApiPropertyOptional({ enum: MentorshipType, description: 'Type d’accompagnement proposé' })
  @IsEnum(MentorshipType)
  @IsOptional()
  typesMentoring?: MentorshipType;

  @ApiPropertyOptional({ description: 'Disponibilités déclarées' })
  @IsString()
  @IsOptional()
  disponibilites?: string;

  @ApiPropertyOptional({ description: 'Biographie / présentation du parcours' })
  @IsString()
  @IsOptional()
  biographie?: string;

  @ApiPropertyOptional({ description: 'URL de la photo de profil' })
  @IsString()
  @IsOptional()
  photoUrl?: string;

  @ApiPropertyOptional({ description: 'URL du profil LinkedIn' })
  @IsString()
  @IsOptional()
  linkedinUrl?: string;

  @ApiPropertyOptional({ description: 'Références professionnelles' })
  @IsString()
  @IsOptional()
  references?: string;
}
