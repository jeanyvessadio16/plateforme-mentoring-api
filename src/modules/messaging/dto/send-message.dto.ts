import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class MessageAttachmentDto {
  @ApiProperty({ description: 'Nom du fichier' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName: string;

  @ApiProperty({ description: 'URL du fichier (http/https uniquement)' })
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @IsNotEmpty()
  fileUrl: string;

  @ApiProperty({ description: 'Taille en octets (max 10 Mo)', minimum: 1, maximum: 10485760 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10485760)
  fileSize: number;

  @ApiProperty({ description: 'Type MIME du fichier', example: 'application/pdf' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  mimeType: string;
}

export class SendMessageDto {
  @ApiProperty({ description: 'Contenu textuel du message' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content: string;

  @ApiPropertyOptional({ type: [MessageAttachmentDto], description: 'Pièces jointes éventuelles' })
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => MessageAttachmentDto)
  @IsOptional()
  attachments?: MessageAttachmentDto[];
}
