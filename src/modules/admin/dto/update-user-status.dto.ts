import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { AccountStatus } from '../../../generated/prisma/client.js';

export class UpdateUserStatusDto {
  @ApiProperty({ enum: AccountStatus })
  @IsEnum(AccountStatus)
  status: AccountStatus;

  @ApiPropertyOptional({ description: 'Motif de validation, refus ou suspension' })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  reason?: string;
}
