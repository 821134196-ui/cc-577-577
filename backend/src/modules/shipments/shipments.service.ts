import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { BoxStatus, DC_CODE, Role, STATUS_LABELS } from '../../common/constants';

@Injectable()
export class ShipmentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 创建调拨交接单（配送中心 -> 门店）。
   * - 只有「可用」（质检合格）的箱子才能出库，其余逐只拦截并说明原因；
   * - 同一箱号重复扫描只计一次，不会多出一只箱；
   * - 出库后箱子进入 IN_TRANSIT，位置唯一（在途于本交接单），不会再被其它批次/交接单占用。
   */
  async create(dto: { toStoreCode: string; driverId: string; boxCodes: string[] }) {
    const store = await this.prisma.store.findUnique({ where: { code: dto.toStoreCode } });
    if (!store) throw new NotFoundException(`门店 ${dto.toStoreCode} 不存在`);
    if (store.isDC) throw new BadRequestException('调拨目的门店不能是配送中心');

    const driver = await this.prisma.user.findUnique({ where: { id: dto.driverId } });
    if (!driver || driver.role !== Role.DRIVER) throw new BadRequestException('请选择有效的配送员');

    const results: { code: string; status: 'added' | 'duplicate' | 'blocked'; reason?: string }[] = [];
    const accepted: { id: string; code: string }[] = [];
    const seen = new Set<string>();

    for (const raw of dto.boxCodes) {
      const code = raw.trim().toUpperCase();
      if (!code) continue;
      if (seen.has(code)) {
        results.push({ code, status: 'duplicate', reason: '重复扫描，已忽略（同一交接单内只计一次）' });
        continue;
      }
      seen.add(code);

      const box = await this.prisma.box.findUnique({ where: { code } });
      if (!box) {
        results.push({ code, status: 'blocked', reason: '箱号不存在' });
        continue;
      }
      if (box.status !== BoxStatus.AVAILABLE) {
        const reason =
          box.status === BoxStatus.QUARANTINE || box.status === BoxStatus.RETURNED || box.status === BoxStatus.SCRAPPED
            ? `质检未通过/不可用（当前状态：${STATUS_LABELS[box.status]}），不得出库`
            : `当前状态为「${STATUS_LABELS[box.status]}」，不可出库`;
        results.push({ code, status: 'blocked', reason });
        continue;
      }
      accepted.push({ id: box.id, code: box.code });
      results.push({ code, status: 'added' });
    }

    if (accepted.length === 0) {
      return { shipment: null, results, message: '没有可出库的箱子，交接单未创建' };
    }

    const count = await this.prisma.shipment.count();
    const code = `SH-${String(count + 1).padStart(4, '0')}`;

    const shipment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.shipment.create({
        data: {
          code,
          toStoreId: store.id,
          driverId: driver.id,
          items: { create: accepted.map((b) => ({ boxId: b.id })) },
        },
        include: { items: { include: { box: true } }, toStore: true, driver: true },
      });
      for (const b of accepted) {
        // 出库期间位置唯一：清空所在门店，绑定到本交接单（在途）
        await tx.box.update({
          where: { id: b.id },
          data: { status: BoxStatus.IN_TRANSIT, currentStoreId: null, currentShipmentId: created.id },
        });
        await tx.boxEvent.create({
          data: {
            boxId: b.id,
            type: 'OUTBOUND',
            actor: driver.name,
            detail: `随交接单 ${code} 出库，配送员 ${driver.name}，发往 ${store.name}（位置：在途）`,
          },
        });
      }
      await tx.notification.create({
        data: {
          audience: `store:${store.code}`,
          message: `交接单 ${code} 已发出（${accepted.length} 只箱，配送员 ${driver.name}），请到店后扫码签收`,
        },
      });
      return created;
    });

    return { shipment, results, message: `交接单 ${code} 已创建，${accepted.length} 只箱出库发往 ${store.name}` };
  }

  list() {
    return this.prisma.shipment.findMany({
      include: { toStore: true, driver: true, items: { include: { box: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async detail(id: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id },
      include: { toStore: true, driver: true, items: { include: { box: true } } },
    });
    if (!shipment) throw new NotFoundException('交接单不存在');
    return shipment;
  }

  /** 门店扫码签收：幂等——重复扫描同一只箱不会形成第二条有效交接 */
  async sign(id: string, boxCode: string) {
    const code = boxCode.trim().toUpperCase();
    const shipment = await this.prisma.shipment.findUnique({
      where: { id },
      include: { items: { include: { box: true } }, toStore: true },
    });
    if (!shipment) throw new NotFoundException('交接单不存在');

    const item = shipment.items.find((it) => it.box.code === code);
    if (!item) throw new NotFoundException(`箱 ${code} 不在交接单 ${shipment.code} 中，无法签收`);
    if (item.status === 'SIGNED') {
      return { ok: true, already: true, message: `重复扫描：箱 ${code} 已签收过，不重复处理` };
    }
    if (item.status === 'REJECTED') {
      throw new ConflictException(`箱 ${code} 已被门店拒收，不能再签收`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.shipmentItem.update({
        where: { id: item.id },
        data: { status: 'SIGNED', signedAt: new Date() },
      });
      // 签收后位置唯一地落在目的门店
      await tx.box.update({
        where: { id: item.boxId },
        data: {
          status: BoxStatus.AT_STORE,
          currentStoreId: shipment.toStoreId,
          currentShipmentId: null,
          lastUsedStoreId: shipment.toStoreId,
        },
      });
      await tx.boxEvent.create({
        data: {
          boxId: item.boxId,
          type: 'SIGNED',
          actor: shipment.toStore.name,
          detail: `门店 ${shipment.toStore.name} 签收（交接单 ${shipment.code}），位置更新为 ${shipment.toStore.name}`,
        },
      });
      await this.closeIfDone(tx, shipment.id, shipment.code);
      await tx.notification.create({
        data: { audience: 'dc', message: `箱 ${code} 已由 ${shipment.toStore.name} 签收（交接单 ${shipment.code}）` },
      });
    });

    return { ok: true, already: false, message: `箱 ${code} 签收成功，位置已更新为 ${shipment.toStore.name}` };
  }

  /** 门店拒收：记录去向（退回配送中心重新处理） */
  async reject(id: string, boxCode: string, reason: string) {
    const code = boxCode.trim().toUpperCase();
    const shipment = await this.prisma.shipment.findUnique({
      where: { id },
      include: { items: { include: { box: true } }, toStore: true },
    });
    if (!shipment) throw new NotFoundException('交接单不存在');

    const item = shipment.items.find((it) => it.box.code === code);
    if (!item) throw new NotFoundException(`箱 ${code} 不在交接单 ${shipment.code} 中`);
    if (item.status !== 'PENDING') {
      throw new ConflictException(`箱 ${code} 已处理（${item.status === 'SIGNED' ? '已签收' : '已拒收'}），不能重复操作`);
    }

    const dc = await this.prisma.store.findUnique({ where: { code: DC_CODE } });

    await this.prisma.$transaction(async (tx) => {
      await tx.shipmentItem.update({
        where: { id: item.id },
        data: { status: 'REJECTED', rejectReason: reason },
      });
      await tx.box.update({
        where: { id: item.boxId },
        data: { status: BoxStatus.RETURNED, currentStoreId: dc.id, currentShipmentId: null },
      });
      await tx.boxEvent.create({
        data: {
          boxId: item.boxId,
          type: 'REJECTED',
          actor: shipment.toStore.name,
          detail: `门店 ${shipment.toStore.name} 拒收（原因：${reason}），箱子退回配送中心待重新清洗`,
        },
      });
      await this.closeIfDone(tx, shipment.id, shipment.code);
      await tx.notification.create({
        data: {
          audience: 'dc',
          message: `箱 ${code} 被 ${shipment.toStore.name} 拒收（${reason}），已退回配送中心待处理`,
        },
      });
    });

    return { ok: true, message: `箱 ${code} 已登记拒收，退回配送中心重新清洗` };
  }

  /** 所有明细处理完毕后关闭交接单 */
  private async closeIfDone(tx: any, shipmentId: string, code: string) {
    const pending = await tx.shipmentItem.count({ where: { shipmentId, status: 'PENDING' } });
    if (pending > 0) return;
    const rejected = await tx.shipmentItem.count({ where: { shipmentId, status: 'REJECTED' } });
    await tx.shipment.update({
      where: { id: shipmentId },
      data: { status: rejected > 0 ? 'PARTIAL' : 'COMPLETED', completedAt: new Date() },
    });
  }
}
