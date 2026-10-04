import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@Query('audience') audience?: string) {
    return this.notifications.list(audience);
  }

  @Post(':id/read')
  read(@Param('id') id: string) {
    return this.notifications.markRead(id);
  }

  @Post('read-all')
  readAll() {
    return this.notifications.markAllRead();
  }
}
