import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class BookSessionDto {
  @ApiPropertyOptional({ description: 'Identifiant du mentor (User.id ou MentorProfile.id)' })
  @IsString()
  @IsOptional()
  mentorId?: string;

  @ApiPropertyOptional({ description: 'Identifiant du bénéficiaire (si réservé par le mentor/admin)' })
  @IsString()
  @IsOptional()
  menteeId?: string;

  @ApiPropertyOptional({ description: 'Identifiant du parcours de mentoring associé' })
  @IsString()
  @IsOptional()
  programId?: string;

  @ApiPropertyOptional({ description: 'Identifiant du créneau de disponibilité utilisé' })
  @IsString()
  @IsOptional()
  slotId?: string;

  @ApiProperty({ description: 'Titre de la session' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  titre: string;

  @ApiProperty({ description: 'Date et heure de début (ISO 8601)' })
  @IsDateString()
  dateDebut: string;

  @ApiProperty({ description: 'Date et heure de fin (ISO 8601)' })
  @IsDateString()
  dateFin: string;

  @ApiPropertyOptional({ description: 'Lien de visioconférence sécurisé (http/https)' })
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @IsOptional()
  meetingUrl?: string;

  @ApiPropertyOptional({ description: 'Notes de préparation' })
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  notes?: string;
}
