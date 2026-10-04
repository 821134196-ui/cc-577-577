import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import ScanInput from '../components/ScanInput';
import StatusBadge from '../components/StatusBadge';
import { fmtTime } from '../labels';

export default function Wash() {
  const [batches, setBatches] = useState<any[]>([]);
  const [cleaners, setCleaners] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [cleanerId, setCleanerId] = useState('');
  const [detergent, setDetergent] = useState('食品级碱性清洗剂');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async () => {
    const list = await api.get('/wash-batches');
    setBatches(list);
    if (selected) setSelected(list.find((b: any) => b.id === selected.id) ?? null);
  };

  useEffect(() => {
    api.get('/users?role=CLEANER').then((u: any[]) => {
      setCleaners(u);
      setCleanerId(u[0]?.id ?? '');
    });
    load();
  }, []);

  const create = async () => {
    setMsg(null);
    try {
      const b = await api.post('/wash-batches', { cleanerId, detergent });
      setMsg({ ok: true, text: `批次 ${b.code} 已创建` });
      await load();
      setSelected(b);
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    }
  };

  const scan = async (code: string) => {
    if (!selected) return;
    setMsg(null);
    try {
      const r = await api.post(`/wash-batches/${selected.id}/scan`, { boxCode: code });
      setMsg({ ok: r.added, text: r.message });
      load();
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    }
  };

  const complete = async () => {
    setMsg(null);
    try {
      const r = await api.post(`/wash-batches/${selected.id}/complete`);
      setMsg({ ok: true, text: r.message });
      load();
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    }
  };

  return (
    <div className="page">
      <h1>清洗批次</h1>
      <div className="grid-2">
        <section className="card">
          <h2>新建批次</h2>
          <div className="form-row">
            <label>清洗员</label>
            <select value={cleanerId} onChange={(e) => setCleanerId(e.target.value)}>
              {cleaners.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label>消毒剂</label>
            <input value={detergent} onChange={(e) => setDetergent(e.target.value)} />
          </div>
          <button className="btn primary" onClick={create}>创建批次</button>

          <h2 style={{ marginTop: 24 }}>批次列表</h2>
          <table className="table">
            <thead><tr><th>批次号</th><th>清洗员</th><th>状态</th><th>箱数</th><th>创建时间</th></tr></thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id} className={selected?.id === b.id ? 'row-selected' : ''} onClick={() => setSelected(b)}>
                  <td className="mono">{b.code}</td>
                  <td>{b.cleaner.name}</td>
                  <td>{b.status === 'OPEN' ? <span className="tag">进行中</span> : <span className="ok">已完成</span>}</td>
                  <td>{b.items.length}</td>
                  <td>{fmtTime(b.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card">
          <h2>批次明细 {selected ? <span className="mono">{selected.code}</span> : ''}</h2>
          {!selected && <p className="muted">请选择左侧批次，或新建一个批次</p>}
          {selected && (
            <>
              <p>清洗员：<b>{selected.cleaner.name}</b>（质检时需回避，不能质检自己的批次）</p>
              <p>消毒剂：{selected.detergent}</p>
              {selected.status === 'OPEN' && (
                <>
                  <h3>扫码加入退回的箱子</h3>
                  <ScanInput onScan={scan} placeholder="扫描「已退回待清洗」的箱号" />
                  <p className="muted small">重复扫描同一只箱只会计一次。</p>
                </>
              )}
              <table className="table">
                <thead><tr><th>箱号</th><th>状态</th><th>加入时间</th><th></th></tr></thead>
                <tbody>
                  {selected.items.map((it: any) => (
                    <tr key={it.id}>
                      <td className="mono">{it.box.code}</td>
                      <td><StatusBadge status={it.box.status} /></td>
                      <td>{fmtTime(it.addedAt)}</td>
                      <td><Link to={`/boxes/${it.box.code}`}>详情</Link></td>
                    </tr>
                  ))}
                  {selected.items.length === 0 && <tr><td colSpan={4} className="muted">尚未加入箱子</td></tr>}
                </tbody>
              </table>
              {selected.status === 'OPEN' && (
                <button className="btn primary" onClick={complete} disabled={selected.items.length === 0}>
                  完成清洗（转入待质检）
                </button>
              )}
            </>
          )}
          {msg && <div className={`alert ${msg.ok ? 'success' : 'error'}`}>{msg.text}</div>}
        </section>
      </div>
    </div>
  );
}
