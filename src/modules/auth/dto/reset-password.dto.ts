import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Nouveau mot de passe sécurisé (au moins 8 caractères)',
    example: 'NouveauMotDePasse123!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' })
  @IsNotEmpty()
  newPassword: string;
}
