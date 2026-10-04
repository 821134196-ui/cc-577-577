import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import StatusBadge from '../components/StatusBadge';
import { CONDITION_LABELS, DISPOSITION_LABELS, EVENT_LABELS, fmtTime, SHIPMENT_STATUS_LABELS } from '../labels';

export default function BoxDetail() {
  const { code } = useParams();
  const [box, setBox] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/boxes/${code}`).then(setBox).catch((e) => setError(e.message));
  }, [code]);

  if (error) return <div className="page"><div className="alert error">{error}</div></div>;
  if (!box) return <div className="page">加载中…</div>;

  const lastWash = box.washItems[0];
  const lastQc = box.qcRecords[0];
  const lastShipmentItem = box.shipmentItems[0];
  const handover = box.currentShipment
    ? { code: box.currentShipment.code, to: box.currentShipment.toStore.name, driver: box.currentShipment.driver.name, status: 'IN_TRANSIT', id: box.currentShipment.id }
    : lastShipmentItem
      ? { code: lastShipmentItem.shipment.code, to: lastShipmentItem.shipment.toStore.name, driver: lastShipmentItem.shipment.driver.name, status: lastShipmentItem.shipment.status, id: lastShipmentItem.shipment.id, itemStatus: lastShipmentItem.status }
      : null;

  return (
    <div className="page">
      <h1>箱子详情 <span className="mono">{box.code}</span></h1>

      <div className="grid-3">
        <section className="card">
          <h2>当前状态</h2>
          <p><StatusBadge status={box.status} /></p>
          <p>箱况：{CONDITION_LABELS[box.condition] ?? box.condition}</p>
          <p>当前位置：<b>{box.currentStore?.name ?? (box.currentShipment ? `在途（${box.currentShipment.code}）` : '-')}</b></p>
          <p>上次使用门店：<b>{box.lastUsedStore?.name ?? '-'}</b></p>
        </section>

        <section className="card">
          <h2>最近清洗 / 质检</h2>
          {lastWash ? (
            <>
              <p>清洗批次：<b>{lastWash.batch.code}</b>（清洗员：{lastWash.batch.cleaner.name}）</p>
              <p>消毒剂：{lastWash.batch.detergent}</p>
            </>
          ) : <p className="muted">暂无清洗记录</p>}
          {lastQc ? (
            <>
              <p>清洗结果（质检）：{lastQc.result === 'PASS' ? <span className="ok">合格</span> : <span className="bad">不合格</span>}</p>
              <p>无残留：{lastQc.residueFree ? '是' : '否'}；已干燥：{lastQc.dried ? '是' : '否'}</p>
              {lastQc.result !== 'PASS' && (
                <p>原因：{lastQc.failReason}；去向：{DISPOSITION_LABELS[lastQc.disposition] ?? lastQc.disposition}</p>
              )}
              <p className="muted small">质检员：{lastQc.inspector.name} · {fmtTime(lastQc.createdAt)}</p>
            </>
          ) : <p className="muted">暂无质检记录</p>}
        </section>

        <section className="card">
          <h2>本次交接</h2>
          {handover ? (
            <>
              <p>交接单：<Link to={`/shipments/${handover.id}`} className="mono">{handover.code}</Link></p>
              <p>目的门店：{handover.to}</p>
              <p>配送员：{handover.driver}</p>
              <p>状态：{SHIPMENT_STATUS_LABELS[handover.status] ?? handover.status}{handover.itemStatus ? `（本箱：${handover.itemStatus === 'SIGNED' ? '已签收' : handover.itemStatus === 'REJECTED' ? '已拒收' : '待签收'}）` : ''}</p>
            </>
          ) : <p className="muted">暂无交接记录</p>}
        </section>
      </div>

      <section className="card">
        <h2>处理记录（事件流水）</h2>
        <ul className="timeline">
          {box.events.map((e: any) => (
            <li key={e.id}>
              <span className="tag">{EVENT_LABELS[e.type] ?? e.type}</span>
              <span> {e.detail}</span>
              <div className="muted small">{fmtTime(e.createdAt)}{e.actor ? ` · 操作方：${e.actor}` : ''}</div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
