import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, Max, Min } from 'class-validator';

export class UpdateMatchingWeightsDto {
  @ApiProperty({ example: 0.3, minimum: 0, maximum: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  expertiseWeight: number;

  @ApiProperty({ example: 0.25, minimum: 0, maximum: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  objectiveWeight: number;

  @ApiProperty({ example: 0.15, minimum: 0, maximum: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  sectorWeight: number;

  @ApiProperty({ example: 0.1, minimum: 0, maximum: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  availabilityWeight: number;

  @ApiProperty({ example: 0.1, minimum: 0, maximum: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  languageWeight: number;

  @ApiProperty({ example: 0.1, minimum: 0, maximum: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  formatWeight: number;
}
