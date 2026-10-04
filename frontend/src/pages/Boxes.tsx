import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import StatusBadge from '../components/StatusBadge';
import { CONDITION_LABELS, STATUS_LABELS } from '../labels';

export default function Boxes() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const [q, setQ] = useState('');
  const [boxes, setBoxes] = useState<any[]>([]);

  const load = () => {
    const qs = new URLSearchParams();
    if (status) qs.set('status', status);
    if (q) qs.set('q', q);
    api.get(`/boxes?${qs}`).then(setBoxes).catch((e) => alert(e.message));
  };

  useEffect(load, [status]);

  return (
    <div className="page">
      <h1>保温箱</h1>
      <div className="toolbar">
        <select value={status} onChange={(e) => setParams(e.target.value ? { status: e.target.value } : {})}>
          <option value="">全部状态</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <input placeholder="按箱号搜索，如 BX-0008" value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()} />
        <button className="btn" onClick={load}>查询</button>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>箱号</th><th>状态</th><th>箱况</th><th>当前位置</th><th>上次使用门店</th><th>最近质检</th><th></th>
          </tr>
        </thead>
        <tbody>
          {boxes.map((b) => (
            <tr key={b.id}>
              <td className="mono">{b.code}</td>
              <td><StatusBadge status={b.status} /></td>
              <td>{CONDITION_LABELS[b.condition] ?? b.condition}</td>
              <td>{b.currentStore?.name ?? (b.currentShipment ? `在途（${b.currentShipment.code} → ${b.currentShipment.toStore.name}）` : '-')}</td>
              <td>{b.lastUsedStore?.name ?? '-'}</td>
              <td>
                {b.qcRecords[0]
                  ? b.qcRecords[0].result === 'PASS'
                    ? <span className="ok">合格</span>
                    : <span className="bad">不合格</span>
                  : <span className="muted">未质检</span>}
              </td>
              <td><Link to={`/boxes/${b.code}`}>详情</Link></td>
            </tr>
          ))}
          {boxes.length === 0 && <tr><td colSpan={7} className="muted">暂无数据</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
