/* eslint-disable no-console */
/**
 * 演示脚本（需后端已启动：npm run dev 或 npm start）：
 *   1) 质检不合格的箱子出库被拦截
 *   2) 重复箱号 / 重复扫描的处理（不多出箱、不形成两个有效交接）
 *   3) 跨店调拨后的位置变化
 */
const BASE = process.env.API_BASE || 'http://localhost:3001/api';

async function req(method: string, path: string, body?: any) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data: any = await res.json().catch(() => ({}));
  return { status: res.status, data };
}
const get = (p: string) => req('GET', p);
const post = (p: string, b?: any) => req('POST', p, b);

function title(s: string) {
  console.log('\n' + '='.repeat(64) + '\n' + s + '\n' + '='.repeat(64));
}
function step(s: string) {
  console.log(`\n→ ${s}`);
}
function showLoc(loc: any) {
  console.log(
    `   箱 ${loc.code} | 状态：${loc.statusLabel} | 当前位置：${loc.location} | 上次使用门店：${loc.lastUsed}`,
  );
}
async function locationOf(code: string) {
  const { data: b } = await get(`/boxes/${code}`);
  return {
    code: b.code,
    statusLabel: ({ AT_STORE: '在门店', RETURNED: '已退回待清洗', WASHING: '清洗中', PENDING_QC: '待质检', AVAILABLE: '可用', IN_TRANSIT: '出库在途', QUARANTINE: '隔离维修', SCRAPPED: '已报废' } as any)[b.status] ?? b.status,
    location: b.currentStore?.name ?? (b.currentShipment ? `在途（${b.currentShipment.code} → ${b.currentShipment.toStore.name}）` : '-'),
    lastUsed: b.lastUsedStore?.name ?? '-',
  };
}

async function main() {
  const users = (await get('/users')).data as any[];
  const cleaner = users.find((u) => u.role === 'CLEANER' && u.name === '王清洗');
  const qc = users.find((u) => u.role === 'QC');
  const driver = users.find((u) => u.role === 'DRIVER');

  // ---------------------------------------------------------------- 演示一
  title('演示一：质检不合格的箱子出库被拦截（含“清洗员不能质检自己的批次”）');

  step('1. 门店 ST-001 退回 BX-0001');
  console.log('  ', (await post('/returns', { storeCode: 'ST-001', boxCode: 'BX-0001', condition: 'DIRTY', note: '演示：油污' })).data.message);

  step('2. 清洗员 王清洗 创建清洗批次并扫码加入 BX-0001，完成清洗');
  const batch = (await post('/wash-batches', { cleanerId: cleaner.id, detergent: '食品级碱性清洗剂' })).data;
  console.log('  ', (await post(`/wash-batches/${batch.id}/scan`, { boxCode: 'BX-0001' })).data.message);
  console.log('  ', (await post(`/wash-batches/${batch.id}/complete`)).data.message);

  step('3. 清洗员 王清洗 尝试质检自己清洗的批次（应被拦截）');
  const selfQc = await post('/qc/inspect', { boxCode: 'BX-0001', inspectorId: cleaner.id, residueFree: true, dried: true });
  console.log(`   HTTP ${selfQc.status}：${selfQc.data.message}`);

  step('4. 质检员 赵质检 判定 BX-0001 不合格（清洗剂残留），处理去向：退回重洗');
  const qcRes = await post('/qc/inspect', {
    boxCode: 'BX-0001', inspectorId: qc.id, residueFree: false, dried: true,
    failReason: '清洗剂残留', disposition: 'REWASH',
  });
  console.log('  ', qcRes.data.message);

  step('5. 尝试把 BX-0001（质检不合格）与 BX-0010（隔离维修）出库（应被逐只拦截）');
  const blocked = await post('/shipments', { toStoreCode: 'ST-002', driverId: driver.id, boxCodes: ['BX-0001', 'BX-0010'] });
  for (const r of blocked.data.results) console.log(`   ${r.code} -> ${r.status}：${r.reason ?? ''}`);
  console.log('  ', blocked.data.message);

  // ---------------------------------------------------------------- 演示二
  title('演示二：重复箱号处理（重复扫描不会多出一只箱，也不会形成两个有效交接）');

  step('1. 创建交接单，扫描列表中 BX-0008 出现两次（先看 BX-0008 出库前位置）');
  showLoc(await locationOf('BX-0008'));
  const dup = await post('/shipments', { toStoreCode: 'ST-002', driverId: driver.id, boxCodes: ['BX-0008', 'BX-0008', 'BX-0009'] });
  for (const r of dup.data.results) console.log(`   ${r.code} -> ${r.status}：${r.reason ?? ''}`);
  const shipment = dup.data.shipment;
  console.log(`   交接单 ${shipment.code} 实际装箱 ${shipment.items.length} 只（不是 3 只）`);

  step('2. 对 SH-0001 中的 BX-0012 连续签收两次（第二次幂等忽略）');
  const sh1 = (await get('/shipments')).data.find((s: any) => s.code === 'SH-0001');
  console.log('   第一次：', (await post(`/shipments/${sh1.id}/sign`, { boxCode: 'BX-0012' })).data.message);
  console.log('   第二次：', (await post(`/shipments/${sh1.id}/sign`, { boxCode: 'BX-0012' })).data.message);
  const bx12items = (await get(`/shipments/${sh1.id}`)).data.items.filter((i: any) => i.box.code === 'BX-0012');
  console.log(`   SH-0001 中 BX-0012 的交接记录数 = ${bx12items.length}（仍然只有一条）`);

  // ---------------------------------------------------------------- 演示三
  title('演示三：跨店调拨后的位置变化');

  step('1. BX-0012 签收前后（配送中心 → 滨江店）');
  showLoc(await locationOf('BX-0012'));
  console.log('   （签收已在演示二完成）');

  step('2. BX-0008 出库后、签收前位置（在途，唯一位置绑定在交接单上）');
  showLoc(await locationOf('BX-0008'));

  step('3. 门店 ST-002 签收 BX-0008 / BX-0009');
  console.log('  ', (await post(`/shipments/${shipment.id}/sign`, { boxCode: 'BX-0008' })).data.message);
  console.log('  ', (await post(`/shipments/${shipment.id}/sign`, { boxCode: 'BX-0009' })).data.message);

  step('4. 签收后位置（同一时刻每只箱只有一个有效位置）');
  showLoc(await locationOf('BX-0008'));
  showLoc(await locationOf('BX-0009'));
  showLoc(await locationOf('BX-0012'));

  console.log('\n演示完成。可运行 npm run seed 重置数据后再次演示。\n');
}

main().catch((e) => {
  console.error('演示失败：', e.message ?? e);
  process.exit(1);
});
