import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UserRole } from '../../generated/prisma/client.js';
import { MessagingService } from './messaging.service.js';
import { CreateConversationDto } from './dto/create-conversation.dto.js';
import { SendMessageDto } from './dto/send-message.dto.js';
import { ListMessagesDto } from './dto/list-messages.dto.js';

@ApiTags('Messagerie')
@ApiBearerAuth('JWT-auth')
@Controller('conversations')
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Get()
  @ApiOperation({ summary: 'F10 - Lister mes conversations avec compteur de non-lus' })
  async listConversations(@CurrentUser('id') userId: string) {
    return this.messagingService.listConversations(userId);
  }

  @Post()
  @ApiOperation({ summary: 'F10 - Ouvrir ou récupérer une conversation autorisée' })
  @ApiResponse({ status: 201, description: 'Conversation ouverte.' })
  @ApiResponse({ status: 403, description: 'Lien de mentoring requis entre les participants.' })
  async startOrGetConversation(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Body() dto: CreateConversationDto,
  ) {
    return this.messagingService.startOrGetConversation(userId, userRole, dto.recipientId);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'F10 - Consulter l’historique paginé des messages' })
  async getMessages(
    @CurrentUser('id') userId: string,
    @Param('id') conversationId: string,
    @Query() query: ListMessagesDto,
  ) {
    return this.messagingService.getMessages(userId, conversationId, query);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'F10 - Envoyer un message avec pièces jointes éventuelles' })
  async sendMessage(
    @CurrentUser('id') userId: string,
    @Param('id') conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messagingService.sendMessage(userId, conversationId, dto);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'F10 - Marquer tous les messages reçus comme lus' })
  async markAsRead(
    @CurrentUser('id') userId: string,
    @Param('id') conversationId: string,
  ) {
    return this.messagingService.markConversationAsRead(userId, conversationId);
  }
}
