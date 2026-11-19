import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { MasterclassStatus } from '../../../generated/prisma/client.js';

export class FilterMasterclassesDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  categorie?: string;

  @ApiPropertyOptional({ enum: MasterclassStatus })
  @IsEnum(MasterclassStatus)
  @IsOptional()
  statut?: MasterclassStatus;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number = 12;
}
