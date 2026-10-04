import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { EVENT_LABELS, fmtTime, STATUS_LABELS } from '../labels';

const ORDER = ['AT_STORE', 'RETURNED', 'WASHING', 'PENDING_QC', 'AVAILABLE', 'IN_TRANSIT', 'QUARANTINE', 'SCRAPPED'];

export default function Dashboard() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    api.get('/dashboard').then(setData).catch((e) => alert(e.message));
  }, []);

  if (!data) return <div className="page">加载中…</div>;

  return (
    <div className="page">
      <h1>配送中心总览</h1>
      <div className="cards">
        {ORDER.map((s) => (
          <Link to={`/boxes?status=${s}`} key={s} className={`card stat stat-${s.toLowerCase()}`}>
            <div className="stat-num">{data.statusCounts[s] ?? 0}</div>
            <div className="stat-label">{STATUS_LABELS[s]}</div>
          </Link>
        ))}
      </div>
      <div className="grid-2">
        <section className="card">
          <h2>最新动态</h2>
          <ul className="timeline">
            {data.recentEvents.map((e: any) => (
              <li key={e.id}>
                <span className="tag">{EVENT_LABELS[e.type] ?? e.type}</span>
                <Link to={`/boxes/${e.box.code}`} className="mono">{e.box.code}</Link>
                <span className="muted"> {e.detail}</span>
                <div className="muted small">{fmtTime(e.createdAt)}</div>
              </li>
            ))}
          </ul>
        </section>
        <section className="card">
          <h2>待办与通知</h2>
          <p>在途交接单：<b>{data.inTransitShipments}</b> 张</p>
          <p>待质检箱子：<b>{data.pendingQc}</b> 只</p>
          <p>未读通知：<b>{data.unreadNotifications}</b> 条</p>
          <ul className="notify-list">
            {data.recentNotifications.map((n: any) => (
              <li key={n.id} className={n.read ? '' : 'unread'}>
                <span className="tag">{n.audience}</span> {n.message}
                <div className="muted small">{fmtTime(n.createdAt)}</div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
