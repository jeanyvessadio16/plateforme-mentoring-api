import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UploadAvatarDto {
  @ApiProperty({
    description: 'Image encodée en base64 ou Data URI (JPG, PNG ou WEBP, max 5 Mo)',
  })
  @IsString()
  @IsNotEmpty({ message: 'Les données de l’image sont obligatoires.' })
  base64Data: string;
}
