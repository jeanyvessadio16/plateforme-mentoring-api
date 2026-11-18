import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Jeton de rafraîchissement (refresh token) obtenu lors de la connexion',
    example: 'dGhpcy1pcy1hLXJlZnJlc2gtdG9rZW4...',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
