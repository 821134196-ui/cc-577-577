import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import ScanInput from '../components/ScanInput';
import { CONDITION_LABELS, fmtTime } from '../labels';

export default function Returns() {
  const [stores, setStores] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [storeCode, setStoreCode] = useState('');
  const [boxCode, setBoxCode] = useState('');
  const [condition, setCondition] = useState('GOOD');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = () => api.get('/returns').then(setRecords).catch((e) => setMsg({ ok: false, text: e.message }));

  useEffect(() => {
    api.get('/stores').then((s: any[]) => {
      const list = s.filter((x) => !x.isDC);
      setStores(list);
      setStoreCode(list[0]?.code ?? '');
    });
    load();
  }, []);

  const submit = async () => {
    setMsg(null);
    if (!boxCode.trim()) return setMsg({ ok: false, text: '请扫描或输入箱号' });
    try {
      const r = await api.post('/returns', { storeCode, boxCode: boxCode.trim(), condition, note: note || undefined });
      setMsg({ ok: true, text: r.message });
      setBoxCode('');
      setNote('');
      load();
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    }
  };

  return (
    <div className="page">
      <h1>门店退回登记</h1>
      <section className="card">
        <h2>登记退回（配送中心回收）</h2>
        <div className="form-row">
          <label>退回门店</label>
          <select value={storeCode} onChange={(e) => setStoreCode(e.target.value)}>
            {stores.map((s) => <option key={s.id} value={s.code}>{s.name}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label>箱号（扫码）</label>
          <ScanInput buttonText="填入箱号" onScan={(c) => setBoxCode(c)} />
          {boxCode && <span className="mono tag">{boxCode}</span>}
        </div>
        <div className="form-row">
          <label>箱况</label>
          <select value={condition} onChange={(e) => setCondition(e.target.value)}>
            {Object.entries(CONDITION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label>备注</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="可选，如：箱内有汤汁残留" />
        </div>
        <button className="btn primary" onClick={submit}>提交退回登记</button>
        {msg && <div className={`alert ${msg.ok ? 'success' : 'error'}`}>{msg.text}</div>}
      </section>

      <section className="card">
        <h2>最近退回记录</h2>
        <table className="table">
          <thead><tr><th>箱号</th><th>退回门店</th><th>箱况</th><th>备注</th><th>时间</th><th></th></tr></thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id}>
                <td className="mono">{r.box.code}</td>
                <td>{r.store.name}</td>
                <td>{CONDITION_LABELS[r.condition] ?? r.condition}</td>
                <td>{r.note ?? '-'}</td>
                <td>{fmtTime(r.createdAt)}</td>
                <td><Link to={`/boxes/${r.box.code}`}>详情</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
