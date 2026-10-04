import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(audience?: string) {
    return this.prisma.notification.findMany({
      where: audience ? { audience } : {},
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  markRead(id: string) {
    return this.prisma.notification.update({ where: { id }, data: { read: true } });
  }

  markAllRead() {
    return this.prisma.notification.updateMany({ data: { read: true } });
  }
}
