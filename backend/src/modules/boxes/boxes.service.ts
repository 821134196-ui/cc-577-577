import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class BoxesService {
  constructor(private readonly prisma: PrismaService) {}

  list(status?: string, q?: string) {
    return this.prisma.box.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(q ? { code: { contains: q.toUpperCase() } } : {}),
      },
      include: {
        currentStore: true,
        lastUsedStore: true,
        currentShipment: { include: { toStore: true } },
        qcRecords: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { code: 'asc' },
    });
  }

  async detail(code: string) {
    const box = await this.prisma.box.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        currentStore: true,
        lastUsedStore: true,
        currentShipment: { include: { toStore: true, driver: true } },
        returns: { include: { store: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        washItems: {
          include: { batch: { include: { cleaner: true } } },
          orderBy: { addedAt: 'desc' },
          take: 1,
        },
        qcRecords: { include: { inspector: true, batch: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        shipmentItems: {
          include: { shipment: { include: { toStore: true, driver: true } } },
          orderBy: { id: 'desc' },
          take: 1,
        },
        events: { orderBy: { createdAt: 'desc' }, take: 100 },
      },
    });
    if (!box) throw new NotFoundException(`箱号 ${code} 不存在`);
    return box;
  }
}
