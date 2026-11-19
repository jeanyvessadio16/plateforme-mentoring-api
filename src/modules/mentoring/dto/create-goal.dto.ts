import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateGoalDto {
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

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(500)
  @IsOptional()
  indicateurs?: string;

  @ApiPropertyOptional({ description: 'Échéance (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  echeance?: string;
}
