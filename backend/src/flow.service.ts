import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { FAIL_REASON_LABEL } from './constants';

const DC = null; // currentStoreId 为 null 表示配送中心

@Injectable()
export class FlowService {
  constructor(private prisma: PrismaService) {}

  // ---------- 基础资料 ----------
  meta() {
    return Promise.all([
      this.prisma.store.findMany({ orderBy: { code: 'asc' } }),
      this.prisma.staff.findMany({ orderBy: { code: 'asc' } }),
    ]).then(([stores, staff]) => ({ stores, staff }));
  }

  // ---------- 箱号建档：重复箱号不得多出一只箱 ----------
  async createBox(code: string, spec?: string) {
    code = code?.trim();
    if (!code) throw new BadRequestException('箱号不能为空');
    try {
      return await this.prisma.box.create({
        data: { code, spec: spec || '标准保温箱 60L', status: 'RETURNED', currentStoreId: DC },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`箱号 ${code} 已存在，重复扫描/建档不会产生第二只箱`);
      }
      throw e;
    }
  }

  listBoxes(params: { code?: string; status?: string }) {
    return this.prisma.box.findMany({
      where: {
        ...(params.code ? { code: { contains: params.code } } : {}),
        ...(params.status ? { status: params.status } : {}),
      },
      orderBy: { code: 'asc' },
      include: {
        currentStore: true,
        lastStore: true,
        activeHandover: { include: { targetStore: true, driver: true } },
      },
    });
  }

  // 箱详情：上次使用门店 + 清洗质检结果 + 本次交接 + 处理记录
  async boxDetail(id: number) {
    const box = await this.prisma.box.findUnique({
      where: { id },
      include: {
        currentStore: true,
        lastStore: true,
        dispositions: { orderBy: { createdAt: 'desc' }, take: 5 },
        locEvents: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { store: true },
        },
      },
    });
    if (!box) throw new NotFoundException('箱子不存在');

    const latestWash = await this.prisma.washRecord.findFirst({
      where: { boxId: id },
      orderBy: { washedAt: 'desc' },
      include: {
        batch: { include: { washer: true } },
        inspection: { include: { inspector: true } },
      },
    });

    const activeHandover = box.activeHandoverId
      ? await this.prisma.handover.findUnique({
          where: { id: box.activeHandoverId },
          include: { targetStore: true, driver: true },
        })
      : null;

    const returns = await this.prisma.returnRecord.findMany({
      where: { boxId: id },
      orderBy: { scannedAt: 'desc' },
      take: 5,
      include: { store: true },
    });

    return { box, lastStore: box.lastStore, latestWash, activeHandover, recentReturns: returns };
  }

  // ---------- 1. 门店回收登记 ----------
  async registerReturn(dto: { boxCode: string; storeCode: string; condition: string; note?: string }) {
    const box = await this.requireBox(dto.boxCode);
    const store = await this.prisma.store.findUnique({ where: { code: dto.storeCode } });
    if (!store) throw new BadRequestException('门店不存在');
    if (!['INTACT', 'DIRTY', 'DAMAGED'].includes(dto.condition)) {
      throw new BadRequestException('箱况必须是 INTACT / DIRTY / DAMAGED');
    }

    return this.prisma.$transaction(async (tx) => {
      // 已在调拨途中的箱不能被回收登记（同一时刻只能有一个有效位置/交接）
      if (box.activeHandoverId) {
        throw new ConflictException(`箱 ${box.code} 存在未完成交接，不能重复登记回收`);
      }

      await tx.returnRecord.create({
        data: { boxId: box.id, storeId: store.id, condition: dto.condition, note: dto.note },
      });
      await tx.locationEvent.create({
        data: { boxId: box.id, action: 'RETURN', fromStoreId: store.id, toStoreId: DC, note: `${store.name} 回收` },
      });

      if (dto.condition === 'DAMAGED') {
        // 箱体破裂：记录去向 —— 直接报废，不进入清洗
        await tx.disposition.create({
          data: { boxId: box.id, reason: 'DAMAGE', action: 'SCRAP', source: 'RETURN', note: dto.note || '回收时发现箱体破裂' },
        });
        await tx.locationEvent.create({
          data: { boxId: box.id, action: 'SCRAP', fromStoreId: store.id, toStoreId: DC, note: '箱体破裂，报废处理' },
        });
        await tx.box.update({
          where: { id: box.id },
          data: { status: 'SCRAPPED', currentStoreId: DC, lastStoreId: store.id },
        });
        await this.notify(tx, 'ERROR', 'DAMAGE_RETURN', '回收发现破裂箱', `箱 ${box.code} 由 ${store.name} 回收时发现破裂，已转报废`, box.code);
        return { disposition: 'SCRAP', message: '箱体破裂，已登记报废去向，不再进入清洗' };
      }

      await tx.box.update({
        where: { id: box.id },
        data: { status: 'RETURNED', currentStoreId: DC, lastStoreId: store.id },
      });
      await this.notify(tx, 'INFO', 'RETURN', '箱子回收到 DC', `箱 ${box.code} 已从 ${store.name} 回收，待安排清洗`, box.code);
      return { disposition: 'WASH_QUEUE', message: '回收成功，已进入待清洗队列' };
    });
  }

  // ---------- 2. 清洗消毒批次 ----------
  async createBatch(dto: { washerCode: string; detergent?: string }) {
    const washer = await this.requireStaff(dto.washerCode, 'WASHER');
    const openCount = await this.prisma.washBatch.count({ where: { washerId: washer.id, status: 'OPEN' } });
    const batchNo = `WB-${washer.code}-${Date.now().toString().slice(-8)}`;
    const batch = await this.prisma.washBatch.create({
      data: { batchNo, washerId: washer.id, detergent: dto.detergent || '含氯消毒液 200ppm' },
    });
    return { ...batch, _openBefore: openCount };
  }

  // 扫描入批：重复扫描同一箱不能重复入批；报废箱不可清洗
  async scanIntoBatch(batchId: number, boxCode: string) {
    const batch = await this.prisma.washBatch.findUnique({ where: { id: batchId }, include: { washer: true } });
    if (!batch) throw new NotFoundException('清洗批次不存在');
    if (batch.status === 'FINISHED') throw new ConflictException('批次已封批，不能再扫描入批');
    const box = await this.requireBox(boxCode);

    if (box.status === 'SCRAPPED') throw new ConflictException('报废箱不能进入清洗');
    if (box.activeHandoverId) throw new ConflictException('箱子处于调拨交接中，不能入批清洗');

    // 正常待清洗 或 质检不合格后返洗
    const allowed = box.status === 'RETURNED' || box.status === 'WASHING' || box.status === 'QUARANTINED';
    if (!allowed) {
      throw new ConflictException(`箱当前状态为 ${box.status}，不能入批清洗（需先回收到 DC）`);
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.washRecord.create({ data: { batchId, boxId: box.id } });
        await tx.box.update({ where: { id: box.id }, data: { status: 'WASHING' } });
        await tx.locationEvent.create({
          data: { boxId: box.id, action: 'WASH', toStoreId: DC, note: `入清洗批次 ${batch.batchNo}（${batch.washer.name}）` },
        });
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`箱 ${box.code} 已在批次 ${batch.batchNo} 中，重复扫描不会重复入批`);
      }
      throw e;
    }
    return { message: `箱 ${box.code} 已入批 ${batch.batchNo}` };
  }

  async finishBatch(batchId: number) {
    const batch = await this.prisma.washBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new NotFoundException('批次不存在');
    if (batch.status === 'FINISHED') throw new ConflictException('批次已封批');
    return this.prisma.washBatch.update({
      where: { id: batchId },
      data: { status: 'FINISHED', finishedAt: new Date() },
    });
  }

  listBatches() {
    return this.prisma.washBatch.findMany({
      orderBy: { startedAt: 'desc' },
      include: {
        washer: true,
        washRecords: { include: { box: true, inspection: { include: { inspector: true } } } },
      },
    });
  }

  // ---------- 3. 质检 ----------
  async inspect(dto: {
    batchId: number;
    boxCode: string;
    inspectorCode: string;
    residueFree: boolean;
    dry: boolean;
    intact: boolean;
    note?: string;
  }) {
    const batch = await this.prisma.washBatch.findUnique({ where: { id: dto.batchId }, include: { washer: true } });
    if (!batch) throw new NotFoundException('清洗批次不存在');
    const inspector = await this.requireStaff(dto.inspectorCode, 'INSPECTOR');
    const box = await this.requireBox(dto.boxCode);
    const washRecord = await this.prisma.washRecord.findUnique({
      where: { batchId_boxId: { batchId: dto.batchId, boxId: box.id } },
    });
    if (!washRecord) throw new BadRequestException(`箱 ${box.code} 不在批次 ${batch.batchNo} 中，无法质检`);
    if (washRecord.id && (await this.prisma.inspection.findUnique({ where: { washRecordId: washRecord.id } }))) {
      throw new ConflictException('该箱本次清洗已质检，不能重复质检');
    }
    // 清洗员不能质检自己的批次
    if (batch.washerId === inspector.id) {
      throw new ForbiddenException(`岗位回避：${inspector.name} 是批次 ${batch.batchNo} 的清洗员，不能质检自己的批次`);
    }

    const failReasons: string[] = [];
    if (!dto.residueFree) failReasons.push('RESIDUE');
    if (!dto.dry) failReasons.push('NOT_DRY');
    if (!dto.intact) failReasons.push('DAMAGE');
    const passed = failReasons.length === 0;

    return this.prisma.$transaction(async (tx) => {
      await tx.inspection.create({
        data: {
          batchId: dto.batchId,
          washRecordId: washRecord.id,
          boxId: box.id,
          inspectorId: inspector.id,
          residueFree: dto.residueFree,
          dry: dto.dry,
          intact: dto.intact,
          passed,
          failReasons: failReasons.join(','),
          note: dto.note,
        },
      });

      if (passed) {
        await tx.box.update({ where: { id: box.id }, data: { status: 'AVAILABLE' } });
        await this.notify(tx, 'INFO', 'QC_PASS', '质检合格', `箱 ${box.code} 无残留、已干燥、箱体完好，可出库`, box.code);
        return { passed: true, message: '质检合格，箱子标记为可用（AVAILABLE）' };
      }

      // 不合格：记录去向，且不得出库
      if (failReasons.includes('DAMAGE')) {
        await tx.disposition.create({
          data: { boxId: box.id, reason: 'DAMAGE', action: 'SCRAP', source: 'INSPECTION', note: '质检发现箱体破裂' },
        });
        await tx.locationEvent.create({ data: { boxId: box.id, action: 'SCRAP', note: '质检判废' } });
        await tx.box.update({ where: { id: box.id }, data: { status: 'SCRAPPED' } });
      } else {
        await tx.disposition.create({
          data: {
            boxId: box.id,
            reason: failReasons.join(','),
            action: 'REWASH',
            source: 'INSPECTION',
            note: failReasons.map((r) => FAIL_REASON_LABEL[r]).join('、'),
          },
        });
        await tx.box.update({ where: { id: box.id }, data: { status: 'QUARANTINED' } });
      }
      const reasonText = failReasons.map((r) => FAIL_REASON_LABEL[r]).join('、');
      await this.notify(tx, 'WARN', 'QC_FAIL', '质检不合格', `箱 ${box.code}：${reasonText}，已隔离并记录去向，禁止出库`, box.code);
      return { passed: false, failReasons, message: `质检不合格（${reasonText}），已隔离，出库将被拦截` };
    });
  }

  // ---------- 4. 出库配送（创建有效交接） ----------
  async createHandover(dto: { boxCode: string; targetStoreCode: string; driverCode: string }) {
    const box = await this.requireBox(dto.boxCode);
    const store = await this.prisma.store.findUnique({ where: { code: dto.targetStoreCode } });
    if (!store) throw new BadRequestException('目标门店不存在');
    const driver = await this.requireStaff(dto.driverCode, 'DRIVER');

    if (box.activeHandoverId) {
      throw new ConflictException('该箱已有在途交接，同一箱号不能同时存在两个有效交接');
    }
    // 硬规则：未通过质检不得出库
    if (box.status !== 'AVAILABLE') {
      await this.notify(
        this.prisma,
        'ERROR',
        'OUTBOUND_BLOCKED',
        '出库被拦截',
        `箱 ${box.code} 当前状态 ${box.status}，非质检合格（AVAILABLE），系统拒绝出库`,
        box.code,
      );
      throw new ConflictException(`出库拦截：箱 ${box.code} 未通过质检（当前 ${box.status}），不得出库`);
    }

    const handoverNo = `HO-${Date.now().toString().slice(-8)}-${box.code.slice(-4)}`;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const handover = await tx.handover.create({
          data: {
            handoverNo,
            boxId: box.id,
            targetStoreId: store.id,
            driverId: driver.id,
            status: 'IN_TRANSIT',
            activeBoxId: box.id, // 唯一约束兜底：不可能出现两个同时有效的交接
          },
        });
        await tx.box.update({
          where: { id: box.id },
          data: { status: 'IN_TRANSIT', activeHandoverId: handover.id, currentStoreId: DC },
        });
        await tx.locationEvent.create({
          data: { boxId: box.id, action: 'OUTBOUND', toStoreId: DC, note: `出库发往 ${store.name}（${driver.name}）` },
        });
        await this.notify(tx, 'INFO', 'OUTBOUND', '箱子出库', `箱 ${box.code} 发往 ${store.name}，单号 ${handoverNo}`, box.code);
        return handover;
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('该箱已存在有效交接，重复出库不会产生第二张交接单');
      }
      throw e;
    }
  }

  listHandovers(status?: string) {
    return this.prisma.handover.findMany({
      where: status ? { status } : {},
      orderBy: { shippedAt: 'desc' },
      include: { box: true, targetStore: true, driver: true },
    });
  }

  // ---------- 5. 门店签收：位置落到门店 ----------
  async signHandover(id: number) {
    const ho = await this.prisma.handover.findUnique({ where: { id }, include: { box: true, targetStore: true } });
    if (!ho) throw new NotFoundException('交接单不存在');
    if (ho.status !== 'IN_TRANSIT') throw new ConflictException(`交接单已结束（${ho.status}），不能签收`);

    return this.prisma.$transaction(async (tx) => {
      await tx.handover.update({
        where: { id },
        data: { status: 'SIGNED', closedAt: new Date(), activeBoxId: null },
      });
      await tx.box.update({
        where: { id: ho.boxId },
        data: { status: 'AT_STORE', activeHandoverId: null, currentStoreId: ho.targetStoreId, lastStoreId: ho.targetStoreId },
      });
      await tx.locationEvent.create({
        data: { boxId: ho.boxId, action: 'SIGN', toStoreId: ho.targetStoreId, note: `${ho.targetStore.name} 签收` },
      });
      await this.notify(tx, 'INFO', 'SIGNED', '门店签收', `箱 ${ho.box.code} 已由 ${ho.targetStore.name} 签收`, ho.box.code);
      return { message: `签收成功，箱 ${ho.box.code} 当前位置：${ho.targetStore.name}` };
    });
  }

  // ---------- 6. 门店拒收：箱子退回 DC 并记录去向 ----------
  async rejectHandover(id: number, reason: string) {
    const ho = await this.prisma.handover.findUnique({ where: { id }, include: { box: true, targetStore: true } });
    if (!ho) throw new NotFoundException('交接单不存在');
    if (ho.status !== 'IN_TRANSIT') throw new ConflictException(`交接单已结束（${ho.status}），不能拒收`);
    if (!reason?.trim()) throw new BadRequestException('拒收原因必填');

    return this.prisma.$transaction(async (tx) => {
      await tx.handover.update({
        where: { id },
        data: { status: 'REJECTED', rejectReason: reason, closedAt: new Date(), activeBoxId: null },
      });
      await tx.disposition.create({
        data: { boxId: ho.boxId, reason: 'STORE_REJECTED', action: 'RETURN_DC', source: 'STORE_REJECT', note: `${ho.targetStore.name} 拒收：${reason}` },
      });
      await tx.box.update({
        where: { id: ho.boxId },
        data: { status: 'RETURNED', activeHandoverId: null, currentStoreId: DC },
      });
      await tx.locationEvent.create({
        data: { boxId: ho.boxId, action: 'REJECT', toStoreId: DC, note: `${ho.targetStore.name} 拒收，退回 DC：${reason}` },
      });
      await this.notify(tx, 'WARN', 'REJECTED', '门店拒收', `箱 ${ho.box.code} 被 ${ho.targetStore.name} 拒收，已退回 DC`, ho.box.code);
      return { message: '拒收已登记，箱子退回配送中心，可重新安排清洗质检' };
    });
  }

  // ---------- 通知 / 位置轨迹 / 去向 ----------
  listNotifications() {
    return this.prisma.appNotification.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  }

  async markNotificationRead(id: number) {
    await this.prisma.appNotification.update({ where: { id }, data: { read: true } });
    return { ok: true };
  }

  listDispositions() {
    return this.prisma.disposition.findMany({
      orderBy: { createdAt: 'desc' },
      include: { box: true },
      take: 100,
    });
  }

  locationTrail(boxId: number) {
    return this.prisma.locationEvent.findMany({
      where: { boxId },
      orderBy: { createdAt: 'asc' },
      include: { store: true },
    });
  }

  // ---------- helpers ----------
  private async requireBox(code: string) {
    const box = await this.prisma.box.findUnique({ where: { code: code?.trim() } });
    if (!box) throw new NotFoundException(`箱号 ${code} 不存在，请先建档`);
    return box;
  }

  private async requireStaff(code: string, role: string) {
    const staff = await this.prisma.staff.findUnique({ where: { code: code?.trim() } });
    if (!staff) throw new NotFoundException(`员工 ${code} 不存在`);
    // 员工可兼岗，role 字段以逗号保存多个岗位
    if (!staff.role.split(',').includes(role)) {
      throw new BadRequestException(`员工 ${staff.name} 不具备 ${role} 岗位权限（岗位：${staff.role}）`);
    }
    return staff;
  }

  private async notify(
    tx: Prisma.TransactionClient | PrismaService,
    level: string,
    type: string,
    title: string,
    message: string,
    boxCode?: string,
  ) {
    await tx.appNotification.create({ data: { level, type, title, message, boxCode } });
  }
}
