import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ description: 'Adresse e-mail du compte', example: 'fatou.diop@example.com' })
  @IsEmail({}, { message: 'Format d’adresse e-mail invalide.' })
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Mot de passe', example: 'MotDePasse123!' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
