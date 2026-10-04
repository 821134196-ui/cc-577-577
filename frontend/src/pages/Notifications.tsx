import { useEffect, useState } from 'react';
import { api } from '../api';
import { fmtTime } from '../labels';

const AUDIENCES: Record<string, string> = {
  dc: '配送中心',
  qc: '质检员',
};

export default function Notifications() {
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState('');

  const load = () => api.get(`/notifications${filter ? `?audience=${filter}` : ''}`).then(setItems);
  useEffect(() => { load(); }, [filter]);

  const readAll = async () => {
    await api.post('/notifications/read-all');
    load();
  };

  const label = (a: string) => AUDIENCES[a] ?? (a.startsWith('store:') ? `门店 ${a.slice(6)}` : a);

  return (
    <div className="page">
      <h1>通知（本地模拟）</h1>
      <div className="toolbar">
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">全部接收方</option>
          <option value="dc">配送中心</option>
          <option value="qc">质检员</option>
          <option value="store:ST-001">门店 ST-001</option>
          <option value="store:ST-002">门店 ST-002</option>
          <option value="store:ST-003">门店 ST-003</option>
        </select>
        <button className="btn" onClick={readAll}>全部标为已读</button>
      </div>
      <ul className="notify-list card">
        {items.map((n) => (
          <li key={n.id} className={n.read ? '' : 'unread'}>
            <span className="tag">{label(n.audience)}</span> {n.message}
            <div className="muted small">{fmtTime(n.createdAt)}{n.read ? ' · 已读' : ' · 未读'}</div>
          </li>
        ))}
        {items.length === 0 && <li className="muted">暂无通知</li>}
      </ul>
    </div>
  );
}
