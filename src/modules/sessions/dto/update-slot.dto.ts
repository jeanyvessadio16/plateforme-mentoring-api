import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';

const HHMM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export class UpdateSlotDto {
  @ApiPropertyOptional({ minimum: 0, maximum: 6 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  @IsOptional()
  dayOfWeek?: number;

  @ApiPropertyOptional({ example: '14:00' })
  @Matches(HHMM_REGEX, { message: 'startTime doit être au format HH:mm.' })
  @IsOptional()
  startTime?: string;

  @ApiPropertyOptional({ example: '15:30' })
  @Matches(HHMM_REGEX, { message: 'endTime doit être au format HH:mm.' })
  @IsOptional()
  endTime?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  specificDate?: string;

  @ApiPropertyOptional()
  @Transform(({ value }) =>
    value === undefined ? undefined : value === true || value === 'true',
  )
  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean;

  @ApiPropertyOptional()
  @Transform(({ value }) =>
    value === undefined ? undefined : value === true || value === 'true',
  )
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
