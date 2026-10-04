import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { BoxStatus, Role, STATUS_LABELS } from '../../common/constants';

@Injectable()
export class WashService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: { cleanerId: string; detergent: string }) {
    const cleaner = await this.prisma.user.findUnique({ where: { id: dto.cleanerId } });
    if (!cleaner || cleaner.role !== Role.CLEANER) {
      throw new BadRequestException('请选择有效的清洗员');
    }
    const count = await this.prisma.washBatch.count();
    const code = `WB-${String(count + 1).padStart(4, '0')}`;
    const batch = await this.prisma.washBatch.create({
      data: { code, cleanerId: cleaner.id, detergent: dto.detergent },
      include: { cleaner: true, items: { include: { box: true } } },
    });
    return batch;
  }

  list() {
    return this.prisma.washBatch.findMany({
      include: { cleaner: true, items: { include: { box: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async detail(id: string) {
    const batch = await this.prisma.washBatch.findUnique({
      where: { id },
      include: { cleaner: true, items: { include: { box: true } } },
    });
    if (!batch) throw new NotFoundException('清洗批次不存在');
    return batch;
  }

  /** 扫码把退回的箱子加入清洗批次；重复扫描幂等，不会多出一只箱 */
  async scan(batchId: string, boxCode: string) {
    const batch = await this.prisma.washBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new NotFoundException('清洗批次不存在');
    if (batch.status !== 'OPEN') throw new ConflictException(`批次 ${batch.code} 已完成，不能再加入箱子`);

    const code = boxCode.toUpperCase();
    const box = await this.prisma.box.findUnique({ where: { code } });
    if (!box) throw new NotFoundException(`箱号 ${code} 不存在`);

    const existing = await this.prisma.washItem.findUnique({
      where: { batchId_boxId: { batchId, boxId: box.id } },
    });
    if (existing) {
      return { added: false, duplicate: true, message: `重复扫描：箱 ${code} 已在本批次中，不会重复计入` };
    }

    if (box.status !== BoxStatus.RETURNED) {
      throw new ConflictException(
        `箱 ${code} 当前状态为「${STATUS_LABELS[box.status] ?? box.status}」，只有「已退回待清洗」的箱子才能加入清洗批次`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.washItem.create({ data: { batchId, boxId: box.id } }),
      this.prisma.box.update({ where: { id: box.id }, data: { status: BoxStatus.WASHING } }),
      this.prisma.boxEvent.create({
        data: { boxId: box.id, type: 'WASH_STARTED', actor: batch.code, detail: `加入清洗批次 ${batch.code}（消毒剂：${batch.detergent}），开始清洗` },
      }),
    ]);

    return { added: true, duplicate: false, message: `箱 ${code} 已加入批次 ${batch.code}` };
  }

  async complete(batchId: string) {
    const batch = await this.prisma.washBatch.findUnique({
      where: { id: batchId },
      include: { items: { include: { box: true } }, cleaner: true },
    });
    if (!batch) throw new NotFoundException('清洗批次不存在');
    if (batch.status !== 'OPEN') throw new ConflictException(`批次 ${batch.code} 已完成`);
    if (batch.items.length === 0) throw new BadRequestException('批次内没有箱子，无法完成');

    await this.prisma.$transaction([
      this.prisma.washBatch.update({
        where: { id: batchId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      }),
      ...batch.items.map((item) =>
        this.prisma.box.update({ where: { id: item.boxId }, data: { status: BoxStatus.PENDING_QC } }),
      ),
      ...batch.items.map((item) =>
        this.prisma.boxEvent.create({
          data: {
            boxId: item.boxId,
            type: 'WASH_COMPLETED',
            actor: batch.cleaner.name,
            detail: `清洗批次 ${batch.code} 完成（清洗员：${batch.cleaner.name}），待质检`,
          },
        }),
      ),
      this.prisma.notification.create({
        data: {
          audience: 'qc',
          message: `清洗批次 ${batch.code}（${batch.items.length} 只箱）已完成，请质检员检验`,
        },
      }),
    ]);

    return { ok: true, message: `批次 ${batch.code} 已完成清洗，${batch.items.length} 只箱进入待质检` };
  }
}
