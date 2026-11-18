import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'Adresse e-mail du compte pour la récupération du mot de passe',
    example: 'fatou.diop@example.com',
  })
  @IsEmail({}, { message: 'Format d’adresse e-mail invalide.' })
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({
    description: 'URL de redirection vers l’application front-end pour réinitialiser le mot de passe',
    example: 'https://monapp.com/reset-password',
  })
  @IsString()
  @IsOptional()
  redirectTo?: string;
}
