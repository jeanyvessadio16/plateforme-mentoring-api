import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ProgramStatus } from '../../../generated/prisma/client.js';

export class UpdateProgramDto {
  @ApiPropertyOptional()
  @IsString()
  @MaxLength(200)
  @IsOptional()
  titre?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: ProgramStatus })
  @IsEnum(ProgramStatus)
  @IsOptional()
  status?: ProgramStatus;

  @ApiPropertyOptional({ description: 'Date de fin prévue (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  endDate?: string;
}
