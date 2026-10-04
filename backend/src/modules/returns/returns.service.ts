import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { BoxStatus, CONDITION_LABELS, DC_CODE, STATUS_LABELS } from '../../common/constants';

@Injectable()
export class ReturnsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: { storeCode: string; boxCode: string; condition: string; note?: string }) {
    const store = await this.prisma.store.findUnique({ where: { code: dto.storeCode } });
    if (!store) throw new NotFoundException(`门店 ${dto.storeCode} 不存在`);
    if (store.isDC) throw new BadRequestException('配送中心不能作为退回门店');

    const box = await this.prisma.box.findUnique({ where: { code: dto.boxCode.toUpperCase() } });
    if (!box) throw new NotFoundException(`箱号 ${dto.boxCode} 不存在`);
    if (box.status !== BoxStatus.AT_STORE || box.currentStoreId !== store.id) {
      throw new ConflictException(
        `退回失败：箱 ${box.code} 当前状态为「${STATUS_LABELS[box.status] ?? box.status}」，不在门店 ${store.name}，无法登记退回`,
      );
    }

    const dc = await this.prisma.store.findUnique({ where: { code: DC_CODE } });

    const [record] = await this.prisma.$transaction([
      this.prisma.returnRecord.create({
        data: { boxId: box.id, storeId: store.id, condition: dto.condition, note: dto.note },
      }),
      this.prisma.box.update({
        where: { id: box.id },
        data: {
          status: BoxStatus.RETURNED,
          condition: dto.condition,
          currentStoreId: dc.id,
          lastUsedStoreId: store.id,
        },
      }),
      this.prisma.boxEvent.create({
        data: {
          boxId: box.id,
          type: 'RETURNED',
          actor: store.name,
          detail: `门店 ${store.name} 退回，箱况：${CONDITION_LABELS[dto.condition]}${dto.note ? `，备注：${dto.note}` : ''}，已回收至配送中心`,
        },
      }),
      this.prisma.notification.create({
        data: {
          audience: 'dc',
          message: `箱 ${box.code} 已由 ${store.name} 退回（${CONDITION_LABELS[dto.condition]}），待安排清洗`,
        },
      }),
    ]);

    return { ok: true, record, message: `箱 ${box.code} 退回登记成功，已回收入配送中心待清洗` };
  }

  list() {
    return this.prisma.returnRecord.findMany({
      include: { box: true, store: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
  }
}
