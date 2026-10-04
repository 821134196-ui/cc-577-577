import { useState } from 'react';
import { createHandover, listBoxes, listHandovers, rejectHandover, signHandover } from '../api';
import { useMeta } from '../meta';
import { BoxStatusTag, ScanInput, usePoll, useToast } from '../ui';
import { HANDOVER_COLOR, HANDOVER_LABEL } from '../status-labels';

// 出库配送 + 门店签收/拒收
export function HandoversPage() {
  const toast = useToast();
  const { stores, staff } = useMeta();
  const drivers = staff.filter((s) => s.role === 'DRIVER');

  const { data: handovers, reload } = usePoll(() => listHandovers(), [], 3000);
  const { data: boxes } = usePoll(() => listBoxes(), [], 5000);
  const available = (boxes || []).filter((b) => b.status === 'AVAILABLE');

  const [targetCode, setTargetCode] = useState(stores[0]?.code || 'S001');
  const [driverCode, setDriverCode] = useState(drivers[0]?.code || 'D01');
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const inTransit = (handovers || []).filter((h) => h.status === 'IN_TRANSIT');
  const closed = (handovers || []).filter((h) => h.status !== 'IN_TRANSIT');

  const outbound = async (boxCode: string) => {
    const r = await toast.call(
      createHandover({ boxCode, targetStoreCode: targetCode, driverCode }),
      '出库成功',
      () => `${boxCode} 已发往 ${stores.find((s) => s.code === targetCode)?.name || targetCode}`,
    );
    if (r) reload();
  };

  return (
    <div>
      <div className="panel">
        <h2>配送出库（跨店调拨）</h2>
        <div className="hint">
          只有质检合格（AVAILABLE）的箱子可出库；质检不合格、报废、在途箱都会被系统拦截。每只箱在签收/拒收前只能有一个有效交接。
        </div>
        <div className="row" style={{ marginBottom: 12 }}>
          <label className="field" style={{ minWidth: 200 }}>
            目标门店
            <select value={targetCode} onChange={(e) => setTargetCode(e.target.value)}>
              {stores.map((s) => <option key={s.id} value={s.code}>{s.name}</option>)}
            </select>
          </label>
          <label className="field" style={{ minWidth: 180 }}>
            配送员
            <select value={driverCode} onChange={(e) => setDriverCode(e.target.value)}>
              {drivers.map((d) => <option key={d.id} value={d.code}>{d.name}</option>)}
            </select>
          </label>
        </div>
        <ScanInput placeholder="扫描合格箱号出库，如 BX-1001" buttonText="出库" onScan={outbound} />
        <div style={{ marginTop: 12 }}>
          <span className="muted">合格可出库：</span>
          {available.length === 0 && <span className="muted">暂无</span>}
          {available.map((b) => (
            <button
              key={b.id}
              className="tag green"
              style={{ border: 0, cursor: 'pointer', marginRight: 8, marginBottom: 4 }}
              onClick={() => outbound(b.code)}
              title={`上次使用：${b.lastStore?.name || 'DC'}，点击出库到 ${targetCode}`}
            >
              {b.code}（{b.lastStore?.name || 'DC'}）
            </button>
          ))}
        </div>
      </div>

      <div className="panel">
        <h2>在途交接 · 待门店处理</h2>
        <table>
          <thead>
            <tr><th>交接单号</th><th>箱号</th><th>目标门店</th><th>配送员</th><th>发运时间</th><th>状态</th><th style={{ width: 230 }}>门店操作</th></tr>
          </thead>
          <tbody>
            {inTransit.map((h) => (
              <tr key={h.id}>
                <td className="mono">{h.handoverNo}</td>
                <td className="mono">{h.box?.code}</td>
                <td>{h.targetStore.name}</td>
                <td>{h.driver.name}</td>
                <td className="muted">{new Date(h.shippedAt).toLocaleString('zh-CN')}</td>
                <td><span className={`tag ${HANDOVER_COLOR[h.status]}`}>{HANDOVER_LABEL[h.status]}</span></td>
                <td>
                  {rejecting === h.id ? (
                    <div className="row">
                      <input
                        placeholder="拒收原因（必填）"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        style={{ width: 130 }}
                      />
                      <button
                        className="btn sm danger"
                        onClick={async () => {
                          const r = await toast.call(rejectHandover(h.id, rejectReason), '已登记拒收', (x) => x.message);
                          if (r) {
                            setRejecting(null);
                            setRejectReason('');
                            reload();
                          }
                        }}
                      >
                        确认拒收
                      </button>
                      <button className="btn secondary sm" onClick={() => setRejecting(null)}>取消</button>
                    </div>
                  ) : (
                    <div className="row">
                      <button
                        className="btn sm green"
                        onClick={async () => {
                          const r = await toast.call(signHandover(h.id), '门店签收成功', (x) => x.message);
                          if (r) reload();
                        }}
                      >
                        ✓ 签收
                      </button>
                      <button className="btn sm danger" onClick={() => setRejecting(h.id)}>拒收</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {!inTransit.length && <tr><td colSpan={7}><div className="empty">暂无在途交接</div></td></tr>}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h2>历史交接</h2>
        <table>
          <thead><tr><th>交接单号</th><th>箱号</th><th>目标门店</th><th>状态</th><th>拒收原因</th><th>完成时间</th></tr></thead>
          <tbody>
            {closed.map((h) => (
              <tr key={h.id}>
                <td className="mono">{h.handoverNo}</td>
                <td className="mono">{h.box?.code}</td>
                <td>{h.targetStore.name}</td>
                <td><span className={`tag ${HANDOVER_COLOR[h.status]}`}>{HANDOVER_LABEL[h.status]}</span></td>
                <td className="muted">{h.rejectReason || '—'}</td>
                <td className="muted">{h.closedAt ? new Date(h.closedAt).toLocaleString('zh-CN') : '—'}</td>
              </tr>
            ))}
            {!closed.length && <tr><td colSpan={6}><div className="empty">暂无历史交接</div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
