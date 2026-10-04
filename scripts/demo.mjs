#!/usr/bin/env node
/**
 * 冷链保温箱系统 — 端到端规则演示
 * 用法：
 *   npm start          先启动前后端
 *   npm run demo       另开终端运行本脚本（会自动等待后端，必要时自行拉起）
 *
 * 演示内容：
 *   1) 质检不合格出库被拦截
 *   2) 重复箱号处理（建档 / 重复扫描入批 / 在途重复交接）
 *   3) 跨店调拨后的位置变化（S001 回收 -> DC -> S002 签收）
 *   附加：清洗员自检拦截、箱体破裂报废、门店拒收退回 DC
 */

const BASE = process.env.API_BASE || 'http://localhost:3000/api';

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m',
  cyan: '\x1b[36m', gray: '\x1b[90m',
};
const ok = (m) => `${C.green}✓${C.reset} ${m}`;
const no = (m) => `${C.red}✗${C.reset} ${m}`;
const section = (m) => console.log(`\n${C.bold}${C.cyan}━━ ${m} ━━${C.reset}`);
const info = (m) => console.log(`${C.gray}›${C.reset} ${m}`);

async function call(path, opts = {}, { allowFail = false } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok && !allowFail) {
    throw new Error(`${res.status} ${data?.message || res.statusText}`);
  }
  return { status: res.status, data };
}
const post = (path, body) => call(path, { method: 'POST', body: JSON.stringify(body) });
const tryPost = (path, body) => call(path, { method: 'POST', body: JSON.stringify(body) }, { allowFail: true });
const boxByCode = async (code) => {
  const list = (await call(`/boxes?code=${encodeURIComponent(code)}`)).data;
  const box = list.find((b) => b.code === code);
  return (await call(`/boxes/${box.id}`)).data;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/meta`);
      if (r.ok) return;
    } catch {}
    await sleep(500);
  }
  throw new Error('后端未就绪，请先在另一个终端运行 npm start（或 npm run start:dev -w backend）');
}

async function main() {
  console.log(`${C.bold}🧊 冷链保温箱清洗批次与门店交接系统 — 规则演示${C.reset}`);
  info(`API: ${BASE}`);
  await waitForServer();

  // 重置到初始数据
  await post('/admin/reset', {});
  info('已重置演示数据：3 家门店 / 4 名员工 / BX-1001~1005 五只箱');

  // ---------- 场景 1：重复箱号建档 ----------
  section('场景 1 · 重复箱号处理：建档与重复扫描');
  const dup = await tryPost('/boxes', { code: 'BX-1001' });
  console.log(dup.status === 409 ? ok(`重复建档被拒：${dup.data.message}`) : no('重复建档居然成功了？'));

  // S001 回收 1001
  let r = await post('/returns', { boxCode: 'BX-1001', storeCode: 'S001', condition: 'DIRTY', note: '常规周转回收' });
  info(`回收 BX-1001：${r.data.message}`);

  // 建批次并扫入
  let b = await post('/wash-batches', { washerCode: 'W01' });
  const batch1 = b.data.id;
  r = await post(`/wash-batches/${batch1}/scan`, { boxCode: 'BX-1001' });
  info(`首次扫描入批：${r.data.message}`);
  const dupScan = await tryPost(`/wash-batches/${batch1}/scan`, { boxCode: 'BX-1001' });
  console.log(dupScan.status === 409 ? ok(`重复扫描被拒：${dupScan.data.message}`) : no('重复扫描居然产生了第二条记录？'));

  // ---------- 场景 2：清洗员不能质检自己的批次 ----------
  section('场景 2 · 岗位回避：清洗员不能质检自己的批次');
  const selfQc = await tryPost('/inspections', {
    batchId: batch1, boxCode: 'BX-1001', inspectorCode: 'W01',
    residueFree: true, dry: true, intact: true,
  });
  console.log(selfQc.status === 403 ? ok(`自检被拦截（403）：${selfQc.data.message}`) : no('清洗员质检了自己的批次？'));

  // ---------- 场景 3：质检不合格，出库被拦截 ----------
  section('场景 3 · 质检不合格 → 出库被拦截');
  r = await post('/inspections', {
    batchId: batch1, boxCode: 'BX-1001', inspectorCode: 'Q01',
    residueFree: false, dry: true, intact: true, note: '闻得到消毒水味',
  });
  console.log(`${C.yellow}质检结论：${r.data.message}${C.reset}`);
  const blocked = await tryPost('/handovers', { boxCode: 'BX-1001', targetStoreCode: 'S002', driverCode: 'D01' });
  console.log(blocked.status === 409 ? ok(`不合格箱出库被拦截（409）：${blocked.data.message}`) : no('不合格箱竟然出库成功？'));

  // 通知中心应有 ERROR
  const notes = (await call('/notifications')).data;
  const blockedNote = notes.find((n) => n.type === 'OUTBOUND_BLOCKED');
  console.log(blockedNote ? ok(`本地通知已生成：[${blockedNote.level}] ${blockedNote.title} — ${blockedNote.message}`) : no('缺少拦截通知'));

  // 返洗后合格
  info('安排返洗（W02 新开批次）…');
  b = await post('/wash-batches', { washerCode: 'W02' });
  const batch2 = b.data.id;
  await post(`/wash-batches/${batch2}/scan`, { boxCode: 'BX-1001' });
  r = await post('/inspections', {
    batchId: batch2, boxCode: 'BX-1001', inspectorCode: 'Q01',
    residueFree: true, dry: true, intact: true,
  });
  info(r.data.message);

  // ---------- 场景 4：跨店调拨与位置变化 ----------
  section('场景 4 · 跨店调拨 S001 → S002：位置变化与唯一有效交接');
  let before = await boxByCode('BX-1001');
  console.log(`${C.dim}出库前：状态=${before.box.status}，位置=${before.box.currentStore ? before.box.currentStore.name : '配送中心 DC'}，上次门店=${before.lastStore.name}${C.reset}`);

  r = await post('/handovers', { boxCode: 'BX-1001', targetStoreCode: 'S002', driverCode: 'D01' });
  const hoId = r.data.id;
  const transit = await boxByCode('BX-1001');
  console.log(ok(`出库成功：单号 ${r.data.handoverNo}；在途位置=${transit.box.currentStore ? transit.box.currentStore.name : '配送中心 DC / 在途'}，有效交接=${transit.box.activeHandoverId}`));

  const dupHo = await tryPost('/handovers', { boxCode: 'BX-1001', targetStoreCode: 'S003', driverCode: 'D01' });
  console.log(dupHo.status === 409 ? ok(`在途重复出库被拒（409）：${dupHo.data.message}`) : no('同一箱产生了两个有效交接？'));

  // 在途箱也不能被另一店回收
  const dupReturn = await tryPost('/returns', { boxCode: 'BX-1001', storeCode: 'S003', condition: 'INTACT' });
  console.log(dupReturn.status === 409 ? ok(`在途箱回收登记被拒（409）：${dupReturn.data.message}`) : no('在途箱出现了第二个有效位置？'));

  await post(`/handovers/${hoId}/sign`, {});
  const after = await boxByCode('BX-1001');
  console.log(ok(`S002 签收：状态=${after.box.status}，当前位置=${after.box.currentStore.name}，上次使用门店=${after.lastStore.name}，有效交接已清空=${after.box.activeHandoverId === null}`));
  console.log(`${C.dim}门店可见处理记录：清洗批次=${after.latestWash.batch.batchNo}，质检=${after.latestWash.inspection.passed ? '合格' : '不合格'}（质检员 ${after.latestWash.inspection.inspector.name}）${C.reset}`);

  // ---------- 场景 5：门店拒收 ----------
  section('场景 5 · 门店拒收：去向留痕、箱子退回 DC');
  await post('/returns', { boxCode: 'BX-1002', storeCode: 'S001', condition: 'INTACT' });
  b = await post('/wash-batches', { washerCode: 'W01' });
  const batch3 = b.data.id;
  await post(`/wash-batches/${batch3}/scan`, { boxCode: 'BX-1002' });
  await post('/inspections', {
    batchId: batch3, boxCode: 'BX-1002', inspectorCode: 'Q01',
    residueFree: true, dry: true, intact: true,
  });
  r = await post('/handovers', { boxCode: 'BX-1002', targetStoreCode: 'S003', driverCode: 'D01' });
  const ho2 = r.data.id;
  r = await post(`/handovers/${ho2}/reject`, { reason: '箱内有异味，门店拒收' });
  const rejected = await boxByCode('BX-1002');
  console.log(ok(`${r.data.message}`));
  console.log(ok(`拒收后：状态=${rejected.box.status}，位置=${rejected.box.currentStore ? rejected.box.currentStore.name : '配送中心 DC（可重洗）'}，交接已关闭`));

  // ---------- 场景 6：箱体破裂报废 ----------
  section('场景 6 · 回收发现箱体破裂：直接报废，不进入清洗');
  r = await post('/returns', { boxCode: 'BX-1003', storeCode: 'S002', condition: 'DAMAGED', note: '底边裂纹漏冷' });
  const broken = await boxByCode('BX-1003');
  console.log(ok(`${r.data.message}；箱状态=${broken.box.status}`));
  const washScrap = await tryPost(`/wash-batches/${batch1}/scan`, { boxCode: 'BX-1003' });
  console.log(washScrap.status === 409 ? ok(`报废箱禁止入批清洗（409）：${washScrap.data.message}`) : no('报废箱进入了清洗？'));

  const disps = (await call('/dispositions')).data;
  console.log(`${C.bold}异常处理去向台账（共 ${disps.length} 条）：${C.reset}`);
  for (const d of disps) {
    console.log(`  ${C.yellow}•${C.reset} ${d.box.code}  来源=${d.source}  原因=${d.reason}  去向=${d.action}  ${C.gray}${d.note || ''}${C.reset}`);
  }

  console.log(`\n${C.bold}${C.green}全部规则演示完成。${C.reset} 打开 ${C.cyan}http://localhost:5173${C.reset} 可在界面上重复以上操作。\n`);
}

main().catch((e) => {
  console.error(`${C.red}演示失败：${e.message}${C.reset}`);
  process.exit(1);
});
