import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { RequestStatus } from '../../../generated/prisma/client.js';

export class ListRequestsDto {
  @ApiPropertyOptional({ enum: ['sent', 'received', 'all'], default: 'all' })
  @IsIn(['sent', 'received', 'all'])
  @IsOptional()
  direction?: 'sent' | 'received' | 'all' = 'all';

  @ApiPropertyOptional({ enum: RequestStatus })
  @IsEnum(RequestStatus)
  @IsOptional()
  status?: RequestStatus;

  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}
