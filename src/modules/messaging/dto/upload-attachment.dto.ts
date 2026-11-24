import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UploadAttachmentDto {
  @ApiProperty({ description: 'Nom original du fichier (ex: document.pdf)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName: string;

  @ApiProperty({ description: 'Contenu du fichier encodé en base64 (PDF, JPG, PNG ou WEBP, max 5 Mo)' })
  @IsString()
  @IsNotEmpty()
  base64Data: string;
}
