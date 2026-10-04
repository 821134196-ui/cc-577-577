import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import ScanInput from '../components/ScanInput';
import { fmtTime, SHIPMENT_STATUS_LABELS } from '../labels';

export default function ShipmentDetail() {
  const { id } = useParams();
  const [shipment, setShipment] = useState<any>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = () => api.get(`/shipments/${id}`).then(setShipment).catch((e) => setMsg({ ok: false, text: e.message }));
  useEffect(() => { load(); }, [id]);

  if (!shipment) return <div className="page">加载中…</div>;

  const sign = async (boxCode: string) => {
    setMsg(null);
    try {
      const r = await api.post(`/shipments/${id}/sign`, { boxCode });
      setMsg({ ok: true, text: r.message });
      load();
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    }
  };

  const reject = async (boxCode: string) => {
    const reason = window.prompt(`请输入拒收原因（箱 ${boxCode}）：`, '箱体破损');
    if (!reason) return;
    setMsg(null);
    try {
      const r = await api.post(`/shipments/${id}/reject`, { boxCode, reason });
      setMsg({ ok: true, text: r.message });
      load();
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    }
  };

  return (
    <div className="page">
      <h1>交接单 <span className="mono">{shipment.code}</span></h1>
      <section className="card">
        <p>目的门店：<b>{shipment.toStore.name}</b> ｜ 配送员：{shipment.driver.name} ｜ 状态：{SHIPMENT_STATUS_LABELS[shipment.status] ?? shipment.status} ｜ 创建：{fmtTime(shipment.createdAt)}</p>
        {shipment.status === 'IN_TRANSIT' && (
          <>
            <h3>门店扫码签收</h3>
            <ScanInput onScan={sign} buttonText="签收" placeholder="扫描到店箱号进行签收（重复扫描自动忽略）" />
          </>
        )}
        {msg && <div className={`alert ${msg.ok ? 'success' : 'error'}`}>{msg.text}</div>}
        <table className="table">
          <thead><tr><th>箱号</th><th>状态</th><th>签收时间</th><th>拒收原因</th><th>操作</th><th></th></tr></thead>
          <tbody>
            {shipment.items.map((it: any) => (
              <tr key={it.id}>
                <td className="mono">{it.box.code}</td>
                <td>
                  {it.status === 'PENDING' && <span className="tag">待签收</span>}
                  {it.status === 'SIGNED' && <span className="ok">已签收</span>}
                  {it.status === 'REJECTED' && <span className="bad">已拒收</span>}
                </td>
                <td>{fmtTime(it.signedAt)}</td>
                <td>{it.rejectReason ?? '-'}</td>
                <td>
                  {it.status === 'PENDING' && (
                    <>
                      <button className="btn small primary" onClick={() => sign(it.box.code)}>签收</button>{' '}
                      <button className="btn small danger" onClick={() => reject(it.box.code)}>拒收</button>
                    </>
                  )}
                </td>
                <td><Link to={`/boxes/${it.box.code}`}>箱子详情</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
