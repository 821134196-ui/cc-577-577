import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  stores() {
    return this.prisma.store.findMany({ orderBy: { code: 'asc' } });
  }

  users(role?: string) {
    return this.prisma.user.findMany({
      where: role ? { role } : {},
      include: { store: true },
      orderBy: { name: 'asc' },
    });
  }

  async dashboard() {
    const boxes = await this.prisma.box.groupBy({ by: ['status'], _count: { _all: true } });
    const statusCounts: Record<string, number> = {};
    for (const row of boxes) statusCounts[row.status] = row._count._all;

    const [inTransitShipments, pendingQc, recentEvents, unreadNotifications, recentNotifications] =
      await Promise.all([
        this.prisma.shipment.count({ where: { status: 'IN_TRANSIT' } }),
        this.prisma.box.count({ where: { status: 'PENDING_QC' } }),
        this.prisma.boxEvent.findMany({
          orderBy: { createdAt: 'desc' },
          take: 15,
          include: { box: { select: { code: true } } },
        }),
        this.prisma.notification.count({ where: { read: false } }),
        this.prisma.notification.findMany({ orderBy: { createdAt: 'desc' }, take: 8 }),
      ]);

    return { statusCounts, inTransitShipments, pendingQc, recentEvents, unreadNotifications, recentNotifications };
  }
}
