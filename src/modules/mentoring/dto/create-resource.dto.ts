import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { ResourceType } from '../../../generated/prisma/client.js';

export class CreateResourceDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  titre: string;

  @ApiPropertyOptional({ enum: ResourceType, default: ResourceType.DOCUMENT })
  @IsEnum(ResourceType)
  @IsOptional()
  type?: ResourceType = ResourceType.DOCUMENT;

  @ApiProperty({ description: 'URL sécurisée de la ressource (http/https)' })
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @IsNotEmpty()
  url: string;
}
