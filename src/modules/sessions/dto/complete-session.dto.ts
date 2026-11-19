import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CompleteSessionDto {
  @ApiPropertyOptional({ description: 'Compte-rendu ou notes de fin de session' })
  @IsString()
  @MaxLength(3000)
  @IsOptional()
  notes?: string;
}
