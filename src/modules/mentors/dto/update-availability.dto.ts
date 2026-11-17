import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateAvailabilityDto {
  @ApiProperty({
    description: 'État de disponibilité du mentor (permet de suspendre temporairement les demandes)',
    example: true,
  })
  @IsBoolean()
  isAvailable: boolean;
}
