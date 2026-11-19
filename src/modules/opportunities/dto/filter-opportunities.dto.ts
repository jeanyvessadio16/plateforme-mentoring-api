import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { OpportunityCategory, OpportunityStatus } from '../../../generated/prisma/client.js';

export class FilterOpportunitiesDto {
  @ApiPropertyOptional({ enum: OpportunityCategory })
  @IsEnum(OpportunityCategory)
  @IsOptional()
  categorie?: OpportunityCategory;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  localisation?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  typeContrat?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: OpportunityStatus })
  @IsEnum(OpportunityStatus)
  @IsOptional()
  status?: OpportunityStatus;

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
