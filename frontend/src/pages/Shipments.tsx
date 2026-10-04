import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import ScanInput from '../components/ScanInput';
import { fmtTime, SHIPMENT_STATUS_LABELS } from '../labels';

export default function Shipments() {
  const [shipments, setShipments] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [toStoreCode, setToStoreCode] = useState('');
  const [driverId, setDriverId] = useState('');
  const [codes, setCodes] = useState<string[]>([]);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const load = () => api.get('/shipments').then(setShipments);

  useEffect(() => {
    api.get('/stores').then((s: any[]) => {
      const list = s.filter((x) => !x.isDC);
      setStores(list);
      setToStoreCode(list[0]?.code ?? '');
    });
    api.get('/users?role=DRIVER').then((u: any[]) => {
      setDrivers(u);
      setDriverId(u[0]?.id ?? '');
    });
    load();
  }, []);

  const addCode = (code: string) => {
    // 本地也允许重复添加，用于演示“重复扫描只计一次”
    setCodes((prev) => [...prev, code]);
  };

  const submit = async () => {
    setError('');
    setResult(null);
    if (codes.length === 0) return setError('请先扫描至少一只箱');
    try {
      const r = await api.post('/shipments', { toStoreCode, driverId, boxCodes: codes });
      setResult(r);
      setCodes([]);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="page">
      <h1>调拨交接（配送中心 → 门店）</h1>
      <div className="grid-2">
        <section className="card">
          <h2>新建交接单（出库）</h2>
          <div className="form-row">
            <label>目的门店</label>
            <select value={toStoreCode} onChange={(e) => setToStoreCode(e.target.value)}>
              {stores.map((s) => <option key={s.id} value={s.code}>{s.name}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label>配送员</label>
            <select value={driverId} onChange={(e) => setDriverId(e.target.value)}>
              {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label>扫描箱号</label>
            <ScanInput onScan={addCode} placeholder="只有「可用」的箱子才能出库" />
          </div>
          {codes.length > 0 && (
            <div className="chips">
              {codes.map((c, i) => (
                <span key={i} className="chip mono" onClick={() => setCodes(codes.filter((_, j) => j !== i))} title="点击移除">
                  {c} ×
                </span>
              ))}
            </div>
          )}
          <button className="btn primary" onClick={submit}>创建交接单并出库</button>
          {error && <div className="alert error">{error}</div>}
          {result && (
            <div className="result-panel">
              <p><b>{result.message}</b></p>
              <table className="table">
                <thead><tr><th>箱号</th><th>结果</th><th>说明</th></tr></thead>
                <tbody>
                  {result.results.map((r: any, i: number) => (
                    <tr key={i}>
                      <td className="mono">{r.code}</td>
                      <td>
                        {r.status === 'added' && <span className="ok">已出库</span>}
                        {r.status === 'duplicate' && <span className="tag">重复扫描</span>}
                        {r.status === 'blocked' && <span className="bad">已拦截</span>}
                      </td>
                      <td>{r.reason ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.shipment && <p><Link to={`/shipments/${result.shipment.id}`}>查看交接单 {result.shipment.code} →</Link></p>}
            </div>
          )}
        </section>

        <section className="card">
          <h2>交接单列表</h2>
          <table className="table">
            <thead><tr><th>单号</th><th>目的门店</th><th>配送员</th><th>状态</th><th>箱数</th><th>创建时间</th><th></th></tr></thead>
            <tbody>
              {shipments.map((s) => (
                <tr key={s.id}>
                  <td className="mono">{s.code}</td>
                  <td>{s.toStore.name}</td>
                  <td>{s.driver.name}</td>
                  <td>{SHIPMENT_STATUS_LABELS[s.status] ?? s.status}</td>
                  <td>{s.items.length}</td>
                  <td>{fmtTime(s.createdAt)}</td>
                  <td><Link to={`/shipments/${s.id}`}>签收/详情</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
