import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class VerifyOtpDto {
  @ApiPropertyOptional({
    description: 'Adresse e-mail associée au code OTP',
    example: 'fatou.diop@example.com',
  })
  @IsEmail({}, { message: 'Format d’adresse e-mail invalide.' })
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    description: 'Code de vérification OTP reçu par e-mail ou SMS',
    example: '123456',
  })
  @IsString()
  @IsOptional()
  token?: string;

  @ApiPropertyOptional({
    description: 'Jeton token_hash reçu dans le lien de confirmation e-mail',
  })
  @IsString()
  @IsOptional()
  tokenHash?: string;

  @ApiPropertyOptional({
    description: 'Type d’opération de vérification',
    enum: ['signup', 'recovery', 'magiclink', 'email_change'],
    default: 'signup',
  })
  @IsString()
  @IsOptional()
  type?: 'signup' | 'recovery' | 'magiclink' | 'email_change' = 'signup';
}
