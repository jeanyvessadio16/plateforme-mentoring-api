import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export class ExportQueryDto {
  @ApiPropertyOptional({ enum: ['csv', 'xlsx', 'pdf'], default: 'csv' })
  @IsIn(['csv', 'xlsx', 'pdf'])
  @IsOptional()
  format?: 'csv' | 'xlsx' | 'pdf' = 'csv';
}
