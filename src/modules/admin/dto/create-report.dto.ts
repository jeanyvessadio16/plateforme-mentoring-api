import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateReportDto {
  @ApiPropertyOptional({ description: 'Identifiant de l’utilisateur signalé (optionnel)' })
  @IsString()
  @IsOptional()
  reportedUserId?: string;

  @ApiProperty({ description: 'Type de cible (USER, MESSAGE, SESSION, PROGRAM, OPPORTUNITY...)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  targetType: string;

  @ApiProperty({ description: 'Identifiant de l’élément signalé' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  targetId: string;

  @ApiProperty({ description: 'Motif détaillé du signalement' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  motif: string;
}
