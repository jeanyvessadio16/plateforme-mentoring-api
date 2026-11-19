import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateGoalDto {
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
  @MaxLength(500)
  @IsOptional()
  indicateurs?: string;

  @ApiPropertyOptional({ description: 'Échéance (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  echeance?: string;

  @ApiPropertyOptional()
  @Transform(({ value }) =>
    value === undefined ? undefined : value === true || value === 'true',
  )
  @IsBoolean()
  @IsOptional()
  isCompleted?: boolean;
}
