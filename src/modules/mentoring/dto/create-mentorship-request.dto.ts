import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateMentorshipRequestDto {
  @ApiProperty({ description: 'Identifiant du mentor (User.id ou MentorProfile.id)' })
  @IsString()
  @IsNotEmpty()
  mentorId: string;

  @ApiProperty({ description: 'Objectif principal de l’accompagnement' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  objectif: string;

  @ApiProperty({ description: 'Problématique ou contexte du besoin' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  problematique: string;

  @ApiProperty({ description: 'Durée souhaitée (ex: 3 mois)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  duree: string;

  @ApiProperty({ description: 'Fréquence souhaitée (ex: 2 fois par mois)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  frequence: string;

  @ApiProperty({ description: 'Format d’accompagnement (INDIVIDUEL, COLLECTIF, etc.)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  format: string;

  @ApiProperty({ description: 'Message de motivation adressé au mentor' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message: string;
}
