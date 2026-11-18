import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({ description: 'Adresse e-mail associée au code OTP', example: 'fatou.diop@example.com' })
  @IsEmail({}, { message: 'Format d’adresse e-mail invalide.' })
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Code de vérification OTP reçu par e-mail ou SMS', example: '123456' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiPropertyOptional({
    description: 'Type d’opération de vérification',
    enum: ['signup', 'recovery', 'magiclink', 'email_change'],
    default: 'signup',
  })
  @IsString()
  @IsOptional()
  type?: 'signup' | 'recovery' | 'magiclink' | 'email_change' = 'signup';
}
