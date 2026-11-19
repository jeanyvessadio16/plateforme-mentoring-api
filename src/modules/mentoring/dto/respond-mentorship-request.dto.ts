import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export type RequestResponseAction = 'ACCEPT' | 'REJECT' | 'CLARIFY';

export class RespondMentorshipRequestDto {
  @ApiProperty({ enum: ['ACCEPT', 'REJECT', 'CLARIFY'], description: 'Décision du mentor' })
  @IsIn(['ACCEPT', 'REJECT', 'CLARIFY'])
  action: RequestResponseAction;

  @ApiPropertyOptional({ description: 'Message de réponse ou demande de précisions' })
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  responseMessage?: string;

  @ApiPropertyOptional({ description: 'Titre personnalisé du parcours créé en cas d’acceptation' })
  @IsString()
  @MaxLength(200)
  @IsOptional()
  programTitle?: string;

  @ApiPropertyOptional({ description: 'Description du parcours créé en cas d’acceptation' })
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  programDescription?: string;
}
