import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class CreateSlotDto {
  @ApiPropertyOptional({ description: 'Jour de la semaine (0=Dimanche .. 6=Samedi)', minimum: 0, maximum: 6 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  @IsOptional()
  dayOfWeek?: number;

  @ApiProperty({ example: '14:00', description: 'Heure de début au format HH:mm' })
  @Matches(HHMM_REGEX, { message: 'startTime doit être au format HH:mm.' })
  startTime: string;

  @ApiProperty({ example: '15:30', description: 'Heure de fin au format HH:mm' })
  @Matches(HHMM_REGEX, { message: 'endTime doit être au format HH:mm.' })
  endTime: string;

  @ApiPropertyOptional({ description: 'Date spécifique pour un créneau ponctuel (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  specificDate?: string;

  @ApiPropertyOptional({ default: true, description: 'Créneau récurrent hebdomadaire ou ponctuel' })
  @Transform(({ value }) =>
    value === undefined ? true : value === true || value === 'true',
  )
  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean = true;
}
