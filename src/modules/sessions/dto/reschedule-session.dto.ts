import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class RescheduleSessionDto {
  @ApiProperty({ description: 'Nouvelle date de début (ISO 8601)' })
  @IsDateString()
  dateDebut: string;

  @ApiProperty({ description: 'Nouvelle date de fin (ISO 8601)' })
  @IsDateString()
  dateFin: string;

  @ApiPropertyOptional({ description: 'Nouveau lien de visioconférence (http/https)' })
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @IsOptional()
  meetingUrl?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  notes?: string;
}
