import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { TaskStatus } from '../../../generated/prisma/client.js';

export class UpdateTaskDto {
  @ApiPropertyOptional()
  @IsString()
  @MaxLength(250)
  @IsOptional()
  titre?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  goalId?: string;

  @ApiPropertyOptional({ description: 'Échéance (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  echeance?: string;

  @ApiPropertyOptional({ enum: TaskStatus })
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;
}
