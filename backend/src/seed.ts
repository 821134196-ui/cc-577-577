/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import { BoxStatus, Condition, DC_CODE, Role } from './common/constants';

const prisma = new PrismaClient();

async function main() {
  console.log('[seed] 清空旧数据...');
  await prisma.$transaction([
    prisma.notification.deleteMany(),
    prisma.boxEvent.deleteMany(),
    prisma.shipmentItem.deleteMany(),
    prisma.shipment.deleteMany(),
    prisma.qcRecord.deleteMany(),
    prisma.washItem.deleteMany(),
    prisma.washBatch.deleteMany(),
    prisma.returnRecord.deleteMany(),
    prisma.box.deleteMany(),
    prisma.user.deleteMany(),
    prisma.store.deleteMany(),
  ]);

  console.log('[seed] 创建门店与人员...');
  const dc = await prisma.store.create({ data: { code: DC_CODE, name: '配送中心', isDC: true } });
  const st1 = await prisma.store.create({ data: { code: 'ST-001', name: '鲜丰门店·城东店' } });
  const st2 = await prisma.store.create({ data: { code: 'ST-002', name: '鲜丰门店·城西店' } });
  const st3 = await prisma.store.create({ data: { code: 'ST-003', name: '鲜丰门店·滨江店' } });

  const cleaner1 = await prisma.user.create({ data: { name: '王清洗', role: Role.CLEANER } });
  const cleaner2 = await prisma.user.create({ data: { name: '李净', role: Role.CLEANER } });
  const qc = await prisma.user.create({ data: { name: '赵质检', role: Role.QC } });
  const driver = await prisma.user.create({ data: { name: '张配送', role: Role.DRIVER } });
  await prisma.user.create({ data: { name: '陈店员', role: Role.CLERK, storeId: st1.id } });
  await prisma.user.create({ data: { name: '林店员', role: Role.CLERK, storeId: st2.id } });
  await prisma.user.create({ data: { name: '周店员', role: Role.CLERK, storeId: st3.id } });
  await prisma.user.create({ data: { name: '系统管理员', role: Role.ADMIN } });

  console.log('[seed] 创建保温箱与业务数据...');
  const mkBox = (code: string, data: Partial<any> = {}) =>
    prisma.box.create({
      data: { code, status: BoxStatus.AT_STORE, condition: Condition.GOOD, ...data },
    });

  // 在门店的箱子
  const bx1 = await mkBox('BX-0001', { currentStoreId: st1.id, lastUsedStoreId: st1.id });
  const bx2 = await mkBox('BX-0002', { currentStoreId: st1.id, lastUsedStoreId: st1.id });
  const bx3 = await mkBox('BX-0003', { currentStoreId: st2.id, lastUsedStoreId: st2.id });
  const bx4 = await mkBox('BX-0004', { currentStoreId: st2.id, lastUsedStoreId: st2.id });

  // 已退回待清洗（BX-0006 箱体破裂）
  const bx5 = await mkBox('BX-0005', {
    status: BoxStatus.RETURNED, condition: Condition.DIRTY, currentStoreId: dc.id, lastUsedStoreId: st1.id,
  });
  await prisma.returnRecord.create({
    data: { boxId: bx5.id, storeId: st1.id, condition: Condition.DIRTY, note: '箱内有汤汁残留' },
  });
  const bx6 = await mkBox('BX-0006', {
    status: BoxStatus.RETURNED, condition: Condition.CRACKED, currentStoreId: dc.id, lastUsedStoreId: st2.id,
  });
  await prisma.returnRecord.create({
    data: { boxId: bx6.id, storeId: st2.id, condition: Condition.CRACKED, note: '箱体侧面破裂' },
  });

  // 已完成的清洗批次 WB-0001（清洗员：王清洗）
  const batch1 = await prisma.washBatch.create({
    data: { code: 'WB-0001', cleanerId: cleaner1.id, detergent: '食品级碱性清洗剂', status: 'COMPLETED', completedAt: new Date() },
  });

  // BX-0007 待质检
  const bx7 = await mkBox('BX-0007', { status: BoxStatus.PENDING_QC, currentStoreId: dc.id, lastUsedStoreId: st1.id });
  await prisma.washItem.create({ data: { batchId: batch1.id, boxId: bx7.id } });

  // BX-0008 / BX-0009 质检合格，可用
  const bx8 = await mkBox('BX-0008', { status: BoxStatus.AVAILABLE, currentStoreId: dc.id, lastUsedStoreId: st2.id });
  await prisma.washItem.create({ data: { batchId: batch1.id, boxId: bx8.id } });
  await prisma.qcRecord.create({
    data: { boxId: bx8.id, batchId: batch1.id, inspectorId: qc.id, residueFree: true, dried: true, result: 'PASS' },
  });
  const bx9 = await mkBox('BX-0009', { status: BoxStatus.AVAILABLE, currentStoreId: dc.id, lastUsedStoreId: st1.id });
  await prisma.washItem.create({ data: { batchId: batch1.id, boxId: bx9.id } });
  await prisma.qcRecord.create({
    data: { boxId: bx9.id, batchId: batch1.id, inspectorId: qc.id, residueFree: true, dried: true, result: 'PASS' },
  });

  // BX-0010 质检不合格 -> 隔离维修
  const bx10 = await mkBox('BX-0010', { status: BoxStatus.QUARANTINE, currentStoreId: dc.id, lastUsedStoreId: st3.id });
  await prisma.washItem.create({ data: { batchId: batch1.id, boxId: bx10.id } });
  await prisma.qcRecord.create({
    data: {
      boxId: bx10.id, batchId: batch1.id, inspectorId: qc.id,
      residueFree: true, dried: false, result: 'FAIL', failReason: '密封条老化、箱内未完全干燥', disposition: 'REPAIR',
    },
  });

  // BX-0011 质检不合格 -> 报废（箱体破裂）
  const bx11 = await mkBox('BX-0011', {
    status: BoxStatus.SCRAPPED, condition: Condition.CRACKED, currentStoreId: dc.id, lastUsedStoreId: st2.id,
  });
  await prisma.washItem.create({ data: { batchId: batch1.id, boxId: bx11.id } });
  await prisma.qcRecord.create({
    data: {
      boxId: bx11.id, batchId: batch1.id, inspectorId: qc.id,
      residueFree: false, dried: true, result: 'FAIL', failReason: '箱体破裂无法修复且有清洗剂残留', disposition: 'SCRAP',
    },
  });

  // BX-0012 出库在途（交接单 SH-0001 -> 滨江店）
  const bx12 = await mkBox('BX-0012', { status: BoxStatus.AVAILABLE, currentStoreId: dc.id, lastUsedStoreId: st1.id });
  await prisma.washItem.create({ data: { batchId: batch1.id, boxId: bx12.id } });
  await prisma.qcRecord.create({
    data: { boxId: bx12.id, batchId: batch1.id, inspectorId: qc.id, residueFree: true, dried: true, result: 'PASS' },
  });
  const shipment1 = await prisma.shipment.create({
    data: { code: 'SH-0001', toStoreId: st3.id, driverId: driver.id, items: { create: [{ boxId: bx12.id }] } },
  });
  await prisma.box.update({
    where: { id: bx12.id },
    data: { status: BoxStatus.IN_TRANSIT, currentStoreId: null, currentShipmentId: shipment1.id },
  });

  console.log('[seed] 写入事件流水与通知...');
  const ev = (boxId: string, type: string, detail: string, actor?: string) =>
    prisma.boxEvent.create({ data: { boxId, type, detail, actor } });

  await ev(bx5.id, 'RETURNED', '门店 鲜丰门店·城东店 退回，箱况：污渍残留，备注：箱内有汤汁残留，已回收至配送中心', st1.name);
  await ev(bx6.id, 'RETURNED', '门店 鲜丰门店·城西店 退回，箱况：箱体破裂，备注：箱体侧面破裂，已回收至配送中心', st2.name);
  for (const [b, store] of [[bx7, st1], [bx8, st2], [bx9, st1], [bx10, st3], [bx11, st2], [bx12, st1]] as const) {
    await ev(b.id, 'RETURNED', `门店 ${store.name} 退回，已回收至配送中心`, store.name);
    await ev(b.id, 'WASH_STARTED', '加入清洗批次 WB-0001（消毒剂：食品级碱性清洗剂），开始清洗', 'WB-0001');
    await ev(b.id, 'WASH_COMPLETED', '清洗批次 WB-0001 完成（清洗员：王清洗），待质检', cleaner1.name);
  }
  await ev(bx8.id, 'QC_PASSED', '质检合格（无残留、已干燥），质检员：赵质检，标为可用', qc.name);
  await ev(bx9.id, 'QC_PASSED', '质检合格（无残留、已干燥），质检员：赵质检，标为可用', qc.name);
  await ev(bx12.id, 'QC_PASSED', '质检合格（无残留、已干燥），质检员：赵质检，标为可用', qc.name);
  await ev(bx10.id, 'QC_FAILED', '质检不合格（密封条老化、箱内未完全干燥），质检员：赵质检，处理去向：隔离维修', qc.name);
  await ev(bx11.id, 'QC_FAILED', '质检不合格（箱体破裂无法修复且有清洗剂残留），质检员：赵质检，处理去向：报废', qc.name);
  await ev(bx12.id, 'OUTBOUND', '随交接单 SH-0001 出库，配送员 张配送，发往 鲜丰门店·滨江店（位置：在途）', driver.name);

  await prisma.notification.createMany({
    data: [
      { audience: 'qc', message: '清洗批次 WB-0001 已完成，请质检员检验' },
      { audience: 'dc', message: '箱 BX-0010 质检不合格：密封条老化、箱内未完全干燥，处理去向：隔离维修' },
      { audience: 'dc', message: '箱 BX-0011 质检不合格：箱体破裂无法修复且有清洗剂残留，处理去向：报废' },
      { audience: 'store:ST-003', message: '交接单 SH-0001 已发出（1 只箱，配送员 张配送），请到店后扫码签收' },
      { audience: 'dc', message: '箱 BX-0005 已由 鲜丰门店·城东店 退回（污渍残留），待安排清洗' },
      { audience: 'dc', message: '箱 BX-0006 已由 鲜丰门店·城西店 退回（箱体破裂），待安排清洗' },
    ],
  });

  console.log('[seed] 完成。门店 4 个（含配送中心），保温箱 12 只，批次 WB-0001，交接单 SH-0001。');
  console.log('[seed] 提示：可用箱 BX-0008 / BX-0009；在途箱 BX-0012（SH-0001 -> ST-003）；待质检 BX-0007。');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
