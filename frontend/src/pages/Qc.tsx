import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { DISPOSITION_LABELS, fmtTime } from '../labels';

export default function Qc() {
  const [pending, setPending] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [inspectors, setInspectors] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [inspectorId, setInspectorId] = useState('');
  const [residueFree, setResidueFree] = useState(true);
  const [dried, setDried] = useState(true);
  const [failReason, setFailReason] = useState('');
  const [disposition, setDisposition] = useState('REWASH');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = () => {
    api.get('/qc/pending').then(setPending);
    api.get('/qc/records').then(setRecords);
  };

  useEffect(() => {
    api.get('/users?role=QC').then((u: any[]) => {
      setInspectors(u);
      setInspectorId(u[0]?.id ?? '');
    });
    api.get('/users').then(setAllUsers);
    load();
  }, []);

  const passing = residueFree && dried;

  const submit = async () => {
    if (!selected) return;
    setMsg(null);
    try {
      const r = await api.post('/qc/inspect', {
        boxCode: selected.code,
        inspectorId,
        residueFree,
        dried,
        failReason: passing ? undefined : failReason,
        disposition: passing ? undefined : disposition,
      });
      setMsg({ ok: true, text: r.message });
      setSelected(null);
      setFailReason('');
      load();
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    }
  };

  const batchOf = (b: any) => b.washItems[0]?.batch;

  return (
    <div className="page">
      <h1>质检台</h1>
      <div className="grid-2">
        <section className="card">
          <h2>待质检（{pending.length}）</h2>
          <table className="table">
            <thead><tr><th>箱号</th><th>清洗批次</th><th>清洗员</th><th></th></tr></thead>
            <tbody>
              {pending.map((b) => (
                <tr key={b.id} className={selected?.id === b.id ? 'row-selected' : ''}>
                  <td className="mono">{b.code}</td>
                  <td>{batchOf(b)?.code}</td>
                  <td>{batchOf(b)?.cleaner.name}</td>
                  <td><button className="btn small" onClick={() => setSelected(b)}>质检</button></td>
                </tr>
              ))}
              {pending.length === 0 && <tr><td colSpan={4} className="muted">暂无待质检箱子</td></tr>}
            </tbody>
          </table>

          {selected && (
            <div className="inspect-panel">
              <h3>质检 {selected.code}（批次 {batchOf(selected)?.code}，清洗员 {batchOf(selected)?.cleaner.name}）</h3>
              <div className="form-row">
                <label>质检员</label>
                <select value={inspectorId} onChange={(e) => setInspectorId(e.target.value)}>
                  <optgroup label="质检员">
                    {inspectors.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </optgroup>
                  <optgroup label="其他人员（用于演示回避规则）">
                    {allUsers.filter((u) => u.role !== 'QC').map((u) => (
                      <option key={u.id} value={u.id}>{u.name}（{u.role === 'CLEANER' ? '清洗员' : '其他'}）</option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <div className="form-row">
                <label><input type="checkbox" checked={residueFree} onChange={(e) => setResidueFree(e.target.checked)} /> 无清洗剂残留</label>
                <label><input type="checkbox" checked={dried} onChange={(e) => setDried(e.target.checked)} /> 已干燥</label>
              </div>
              {!passing && (
                <>
                  <div className="form-row">
                    <label>不合格原因</label>
                    <input value={failReason} onChange={(e) => setFailReason(e.target.value)} placeholder="如：清洗剂残留 / 箱体破裂" />
                  </div>
                  <div className="form-row">
                    <label>处理去向</label>
                    <select value={disposition} onChange={(e) => setDisposition(e.target.value)}>
                      {Object.entries(DISPOSITION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                </>
              )}
              <p>判定结果：{passing ? <span className="ok">合格（标为可用）</span> : <span className="bad">不合格（不得出库）</span>}</p>
              <button className="btn primary" onClick={submit}>提交质检结果</button>
              {msg && <div className={`alert ${msg.ok ? 'success' : 'error'}`}>{msg.text}</div>}
            </div>
          )}
          {!selected && msg && <div className={`alert ${msg.ok ? 'success' : 'error'}`}>{msg.text}</div>}
        </section>

        <section className="card">
          <h2>质检记录</h2>
          <table className="table">
            <thead><tr><th>箱号</th><th>批次</th><th>质检员</th><th>结果</th><th>原因/去向</th><th>时间</th></tr></thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td className="mono"><Link to={`/boxes/${r.box.code}`}>{r.box.code}</Link></td>
                  <td>{r.batch.code}</td>
                  <td>{r.inspector.name}</td>
                  <td>{r.result === 'PASS' ? <span className="ok">合格</span> : <span className="bad">不合格</span>}</td>
                  <td>{r.result === 'PASS' ? '-' : `${r.failReason} / ${DISPOSITION_LABELS[r.disposition] ?? r.disposition}`}</td>
                  <td>{fmtTime(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
