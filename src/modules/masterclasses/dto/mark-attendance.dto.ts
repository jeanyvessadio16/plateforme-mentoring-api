import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean } from 'class-validator';

export class MarkAttendanceDto {
  @ApiProperty({ description: 'Présence confirmée à la masterclass' })
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  attended: boolean;
}
