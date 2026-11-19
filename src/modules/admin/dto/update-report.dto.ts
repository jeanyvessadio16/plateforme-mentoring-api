import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ReportStatus } from '../../../generated/prisma/client.js';

export class UpdateReportDto {
  @ApiProperty({ enum: ReportStatus })
  @IsEnum(ReportStatus)
  status: ReportStatus;

  @ApiPropertyOptional({ description: 'Notes d’instruction administrateur' })
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  adminNotes?: string;
}
