import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTaskDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  titre: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Identifiant du sous-objectif lié' })
  @IsString()
  @IsOptional()
  goalId?: string;

  @ApiPropertyOptional({ description: 'Échéance (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  echeance?: string;
}
