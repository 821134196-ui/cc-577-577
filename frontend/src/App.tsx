import { useEffect, useMemo, useState } from 'react';
import { getMeta, listNotifications, markRead, boxDetail, resetDemo } from './api';
import type { BoxDetail } from './types';
import { MetaContext, type Meta } from './meta';
import { Modal, usePoll } from './ui';
import { BoxDetailView } from './pages/BoxDetail';
import { DashboardPage } from './pages/Dashboard';
import { BoxesPage } from './pages/BoxesPage';
import { ReturnsPage } from './pages/ReturnsPage';
import { WashPage } from './pages/WashPage';
import { HandoversPage } from './pages/HandoversPage';
import { DispositionsPage } from './pages/DispositionsPage';

type Tab = 'dashboard' | 'boxes' | 'returns' | 'wash' | 'handovers' | 'dispositions';

const TABS: Array<{ key: Tab; icon: string; label: string }> = [
  { key: 'dashboard', icon: '📊', label: '总览' },
  { key: 'boxes', icon: '📦', label: '箱号档案' },
  { key: 'returns', icon: '↩️', label: '门店回收' },
  { key: 'wash', icon: '🧼', label: '清洗质检' },
  { key: 'handovers', icon: '🚚', label: '配送交接' },
  { key: 'dispositions', icon: '⚠️', label: '异常去向' },
];

export default function App() {
  const [meta, setMeta] = useState<Meta>({ stores: [], staff: [] });
  const [tab, setTab] = useState<Tab>('dashboard');
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detail, setDetail] = useState<BoxDetail | null>(null);
  const [showBell, setShowBell] = useState(false);

  useEffect(() => {
    getMeta().then(setMeta).catch(() => undefined);
  }, []);

  const { data: notes, reload: reloadNotes } = usePoll(() => listNotifications(), [], 5000);
  const unread = useMemo(() => (notes || []).filter((n) => !n.read).length, [notes]);

  const openBox = async (id: number) => {
    setDetailId(id);
    setDetail(await boxDetail(id));
  };
  const closeDetail = () => {
    setDetailId(null);
    setDetail(null);
  };

  // 详情弹窗打开期间定时刷新
  useEffect(() => {
    if (!detailId) return;
    const t = setInterval(() => boxDetail(detailId).then(setDetail).catch(() => undefined), 3000);
    return () => clearInterval(t);
  }, [detailId]);

  return (
    <MetaContext.Provider value={meta}>
      <header className="topbar">
        <div>
          <h1>🧊 冷链保温箱清洗批次与门店交接系统</h1>
          <div className="sub">回收登记 · 清洗消毒批次 · 质检放行 · 跨店调拨 · 门店签收</div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button
            className="btn secondary"
            title="清空并重新生成初始演示数据"
            style={{ background: 'rgba(255,255,255,.15)', color: '#fff', border: '1px solid rgba(255,255,255,.3)' }}
            onClick={async () => {
              if (!window.confirm('确认重置全部演示数据？（3 家门店 / 4 名员工 / 5 只箱）')) return;
              const r = await resetDemo().catch((e) => {
                window.alert(e.message);
                return null;
              });
              if (r) {
                setTab('dashboard');
                window.location.reload();
              }
            }}
          >
            ♻️ 重置演示数据
          </button>
          <div style={{ position: 'relative' }}>
          <button
            className="btn secondary"
            onClick={() => {
              setShowBell((v) => !v);
            }}
            style={{ background: 'rgba(255,255,255,.15)', color: '#fff', border: '1px solid rgba(255,255,255,.3)' }}
          >
            🔔 通知中心{unread > 0 ? ` (${unread})` : ''}
          </button>
          {showBell && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: 42,
                width: 360,
                maxHeight: 420,
                overflow: 'auto',
                background: '#fff',
                color: 'var(--text)',
                borderRadius: 12,
                boxShadow: '0 12px 32px rgba(15,23,42,.25)',
                padding: 8,
                zIndex: 30,
              }}
            >
              {(notes || []).slice(0, 20).map((n) => (
                <div
                  key={n.id}
                  onClick={() => !n.read && markRead(n.id).then(reloadNotes)}
                  style={{
                    padding: '9px 10px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: n.read ? 'transparent' : '#f0f7ff',
                    borderLeft: `3px solid ${n.level === 'ERROR' ? 'var(--red)' : n.level === 'WARN' ? 'var(--amber)' : 'var(--primary)'}`,
                    marginBottom: 6,
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {n.level === 'ERROR' ? '⛔ ' : n.level === 'WARN' ? '⚠️ ' : 'ℹ️ '}
                    {n.title}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{n.message}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{new Date(n.createdAt).toLocaleString('zh-CN')}</div>
                </div>
              ))}
              {!notes?.length && <div className="empty">暂无通知</div>}
            </div>
          )}
          </div>
        </div>
      </header>

      <div className="layout">
        <nav className="side">
          {TABS.map((t) => (
            <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
              <span>{t.icon}</span>
              <span>{t.label}</span>
              {t.key === 'handovers' && unread > 0 && <span className="badge">{unread}</span>}
            </button>
          ))}
        </nav>
        <main>
          {tab === 'dashboard' && <DashboardPage openBox={openBox} />}
          {tab === 'boxes' && <BoxesPage openBox={openBox} />}
          {tab === 'returns' && <ReturnsPage />}
          {tab === 'wash' && <WashPage />}
          {tab === 'handovers' && <HandoversPage />}
          {tab === 'dispositions' && <DispositionsPage openBox={openBox} />}
        </main>
      </div>

      {detailId && detail && (
        <Modal title={`箱子详情 · ${detail.box.code}`} onClose={closeDetail} wide>
          <BoxDetailView data={detail} />
        </Modal>
      )}
    </MetaContext.Provider>
  );
}
