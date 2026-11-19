import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ProgramStatus } from '../../../generated/prisma/client.js';

export class ListProgramsDto {
  @ApiPropertyOptional({ enum: ['mentor', 'mentee', 'all'], default: 'all' })
  @IsIn(['mentor', 'mentee', 'all'])
  @IsOptional()
  role?: 'mentor' | 'mentee' | 'all' = 'all';

  @ApiPropertyOptional({ enum: ProgramStatus })
  @IsEnum(ProgramStatus)
  @IsOptional()
  status?: ProgramStatus;

  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}
