import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { BoxStatus, DISPOSITION_LABELS, Disposition, Role } from '../../common/constants';

@Injectable()
export class QcService {
  constructor(private readonly prisma: PrismaService) {}

  /** 待质检箱子（含所属清洗批次与清洗员，便于前端提示回避规则） */
  pending() {
    return this.prisma.box.findMany({
      where: { status: BoxStatus.PENDING_QC },
      include: {
        washItems: {
          include: { batch: { include: { cleaner: true } } },
          orderBy: { addedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { code: 'asc' },
    });
  }

  records() {
    return this.prisma.qcRecord.findMany({
      include: { box: true, inspector: true, batch: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async inspect(dto: {
    boxCode: string;
    inspectorId: string;
    residueFree: boolean;
    dried: boolean;
    failReason?: string;
    disposition?: string;
  }) {
    const code = dto.boxCode.toUpperCase();
    const box = await this.prisma.box.findUnique({
      where: { code },
      include: {
        washItems: { include: { batch: { include: { cleaner: true } } }, orderBy: { addedAt: 'desc' }, take: 1 },
      },
    });
    if (!box) throw new NotFoundException(`箱号 ${code} 不存在`);
    if (box.status !== BoxStatus.PENDING_QC) {
      throw new ConflictException(`箱 ${code} 当前不在待质检状态，无法质检`);
    }
    const lastWash = box.washItems[0];
    if (!lastWash) throw new ConflictException(`箱 ${code} 没有清洗记录，不能质检`);

    const inspector = await this.prisma.user.findUnique({ where: { id: dto.inspectorId } });
    if (!inspector) throw new BadRequestException('请选择有效的质检员');

    // 规则：清洗员不能质检自己的批次（优先于角色校验，给出明确拦截原因）
    if (lastWash.batch.cleanerId === inspector.id) {
      throw new ForbiddenException(
        `质检被拦截：${inspector.name} 是批次 ${lastWash.batch.code} 的清洗员，不能质检自己清洗的批次`,
      );
    }
    if (inspector.role !== Role.QC) {
      throw new BadRequestException(`${inspector.name} 不是质检员，请重新选择`);
    }

    const passed = dto.residueFree && dto.dried;
    if (!passed && !dto.disposition) {
      throw new BadRequestException('质检不合格时必须选择处理去向（退回重洗 / 隔离维修 / 报废）');
    }
    if (!passed && !dto.failReason?.trim()) {
      throw new BadRequestException('质检不合格时必须填写不合格原因');
    }

    // 不合格 -> 处理去向决定箱子的下一状态
    const nextStatus = passed
      ? BoxStatus.AVAILABLE
      : dto.disposition === Disposition.REWASH
        ? BoxStatus.RETURNED
        : dto.disposition === Disposition.REPAIR
          ? BoxStatus.QUARANTINE
          : BoxStatus.SCRAPPED;

    const detail = passed
      ? `质检合格（无残留、已干燥），质检员：${inspector.name}，标为可用`
      : `质检不合格（${dto.failReason}），质检员：${inspector.name}，处理去向：${DISPOSITION_LABELS[dto.disposition]}`;

    const [record] = await this.prisma.$transaction([
      this.prisma.qcRecord.create({
        data: {
          boxId: box.id,
          batchId: lastWash.batchId,
          inspectorId: inspector.id,
          residueFree: dto.residueFree,
          dried: dto.dried,
          result: passed ? 'PASS' : 'FAIL',
          failReason: passed ? null : dto.failReason,
          disposition: passed ? null : dto.disposition,
        },
      }),
      this.prisma.box.update({ where: { id: box.id }, data: { status: nextStatus } }),
      this.prisma.boxEvent.create({
        data: { boxId: box.id, type: passed ? 'QC_PASSED' : 'QC_FAILED', actor: inspector.name, detail },
      }),
      this.prisma.notification.create({
        data: {
          audience: 'dc',
          message: passed
            ? `箱 ${code} 质检合格，已可出库（批次 ${lastWash.batch.code}）`
            : `箱 ${code} 质检不合格：${dto.failReason}，处理去向：${DISPOSITION_LABELS[dto.disposition]}（批次 ${lastWash.batch.code}）`,
        },
      }),
    ]);

    return {
      ok: true,
      record,
      nextStatus,
      message: passed ? `箱 ${code} 质检合格，已标为可用` : `箱 ${code} 质检不合格，${DISPOSITION_LABELS[dto.disposition]}`,
    };
  }
}
