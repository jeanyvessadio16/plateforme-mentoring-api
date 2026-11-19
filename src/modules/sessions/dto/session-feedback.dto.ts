import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class SessionFeedbackDto {
  @ApiPropertyOptional({ description: 'Commentaire de retour sur la session' })
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  feedback?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 5, description: 'Note de satisfaction (1 à 5)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  rating?: number;
}
