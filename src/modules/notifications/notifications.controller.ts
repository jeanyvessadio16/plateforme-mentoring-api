import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { NotificationsService } from './notifications.service.js';
import { ListNotificationsDto } from './dto/list-notifications.dto.js';

@ApiTags('Notifications')
@ApiBearerAuth('JWT-auth')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'F15 - Lister mes notifications et le nombre de non lues' })
  @ApiResponse({ status: 200, description: 'Liste paginée des notifications.' })
  async listMyNotifications(
    @CurrentUser('id') userId: string,
    @Query() query: ListNotificationsDto,
  ) {
    return this.notificationsService.listForUser(userId, query);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'F15 - Marquer toutes mes notifications comme lues' })
  @ApiResponse({ status: 200, description: 'Notifications marquées comme lues.' })
  async markAllAsRead(@CurrentUser('id') userId: string) {
    return this.notificationsService.markAllAsRead(userId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'F15 - Marquer une notification comme lue' })
  @ApiResponse({ status: 200, description: 'Notification mise à jour.' })
  async markAsRead(
    @CurrentUser('id') userId: string,
    @Param('id') notificationId: string,
  ) {
    return this.notificationsService.markAsRead(userId, notificationId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'F15 - Supprimer une notification' })
  @ApiResponse({ status: 200, description: 'Notification supprimée.' })
  async deleteNotification(
    @CurrentUser('id') userId: string,
    @Param('id') notificationId: string,
  ) {
    return this.notificationsService.deleteNotification(userId, notificationId);
  }
}
