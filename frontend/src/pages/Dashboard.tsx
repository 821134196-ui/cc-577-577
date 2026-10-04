import { listBoxes, listBatches, listHandovers, listDispositions, listNotifications } from '../api';
import { usePoll, BoxStatusTag } from '../ui';
import { HANDOVER_COLOR, HANDOVER_LABEL } from '../status-labels';
import { useMeta } from '../meta';

export function DashboardPage({ openBox }: { openBox: (id: number) => void }) {
  const { stores } = useMeta();
  const { data: boxes } = usePoll(() => listBoxes(), [], 5000);
  const { data: batches } = usePoll(() => listBatches(), [], 5000);
  const { data: handovers } = usePoll(() => listHandovers(), [], 5000);
  const { data: dispositions } = usePoll(() => listDispositions(), [], 5000);
  const { data: notes } = usePoll(() => listNotifications(), [], 5000);

  const inTransit = (handovers || []).filter((h) => h.status === 'IN_TRANSIT');
  const available = (boxes || []).filter((b) => b.status === 'AVAILABLE').length;
  const quarantined = (boxes || []).filter((b) => b.status === 'QUARANTINED').length;

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="grid cols-4">
        <div className="stat"><div className="n" style={{ color: 'var(--green)' }}>{available}</div><div className="l">合格可出库</div></div>
        <div className="stat"><div className="n" style={{ color: 'var(--amber)' }}>{inTransit.length}</div><div className="l">在途交接</div></div>
        <div className="stat"><div className="n" style={{ color: 'var(--red)' }}>{quarantined}</div><div className="l">质检隔离</div></div>
        <div className="stat"><div className="n">{boxes?.length ?? '-'}</div><div className="l">保温箱总数</div></div>
      </div>

      <div className="grid cols-3">
        <div className="panel" style={{ marginBottom: 0 }}>
          <h2>在途交接（待门店签收）</h2>
          <div className="hint">同一箱号在签收/拒收前只允许一个有效交接</div>
          <table>
            <thead><tr><th>单号</th><th>箱号</th><th>目标门店</th><th>状态</th></tr></thead>
            <tbody>
              {inTransit.map((h) => (
                <tr key={h.id}>
                  <td className="mono">{h.handoverNo}</td>
                  <td><a onClick={() => openBox(h.boxId)} style={{ cursor: 'pointer' }}>{h.box?.code}</a></td>
                  <td>{h.targetStore.name}</td>
                  <td><span className={`tag ${HANDOVER_COLOR[h.status]}`}>{HANDOVER_LABEL[h.status]}</span></td>
                </tr>
              ))}
              {!inTransit.length && <tr><td colSpan={4}><div className="empty">暂无在途</div></td></tr>}
            </tbody>
          </table>
        </div>

        <div className="panel" style={{ marginBottom: 0 }}>
          <h2>各店箱量</h2>
          <table>
            <tbody>
              {stores.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{(boxes || []).filter((b) => b.currentStoreId === s.id).length} 只</td>
                </tr>
              ))}
              <tr><td>配送中心 DC</td><td>{(boxes || []).filter((b) => b.currentStoreId === null).length} 只</td></tr>
            </tbody>
          </table>
          <div className="hint" style={{ marginTop: 12 }}>
            开放清洗批次：{(batches || []).filter((b) => b.status === 'OPEN').length} 个
          </div>
        </div>

        <div className="panel" style={{ marginBottom: 0 }}>
          <h2>最新通知（本地模拟）</h2>
          <div className="timeline">
            {(notes || []).slice(0, 8).map((n) => (
              <div key={n.id} className="ev" style={{ color: n.level === 'ERROR' ? 'var(--red)' : n.level === 'WARN' ? 'var(--amber)' : undefined }}>
                <div>{n.title}</div>
                <div className="t">{n.message}</div>
                <div className="t">{new Date(n.createdAt).toLocaleTimeString('zh-CN')}</div>
              </div>
            ))}
            {!notes?.length && <div className="empty">暂无通知</div>}
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 0 }}>
        <h2>最近异常处理去向</h2>
        <table>
          <thead><tr><th>时间</th><th>箱号</th><th>来源</th><th>原因</th><th>去向</th><th>说明</th></tr></thead>
          <tbody>
            {(dispositions || []).slice(0, 6).map((d) => (
              <tr key={d.id}>
                <td className="muted">{new Date(d.createdAt).toLocaleString('zh-CN')}</td>
                <td className="mono"><a onClick={() => openBox(d.boxId)} style={{ cursor: 'pointer' }}>{d.box.code}</a></td>
                <td>{({ RETURN: '回收', INSPECTION: '质检', STORE_REJECT: '门店拒收' } as Record<string, string>)[d.source]}</td>
                <td><span className="tag red">{d.reason.split(',').join(' / ')}</span></td>
                <td><span className="tag amber">{({ SCRAP: '报废', REWASH: '返洗', RETURN_DC: '退回DC' } as Record<string, string>)[d.action]}</span></td>
                <td className="muted">{d.note}</td>
              </tr>
            ))}
            {!dispositions?.length && <tr><td colSpan={6}><div className="empty">暂无异常处理记录</div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
