import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateConversationDto {
  @ApiProperty({ description: 'Identifiant du destinataire (User.id)' })
  @IsString()
  @IsNotEmpty()
  recipientId: string;
}
