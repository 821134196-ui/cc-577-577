import { useState } from 'react';
import { registerReturn, listBoxes } from '../api';
import { useMeta } from '../meta';
import { BoxStatusTag, usePoll, useToast } from '../ui';

// 门店回收登记
export function ReturnsPage() {
  const toast = useToast();
  const { stores } = useMeta();
  const [boxCode, setBoxCode] = useState('');
  const [storeCode, setStoreCode] = useState(stores[0]?.code || 'S001');
  const [condition, setCondition] = useState('INTACT');
  const [note, setNote] = useState('');
  const { data: boxes, reload } = usePoll(() => listBoxes('', 'RETURNED'), [], 5000);

  const submit = async () => {
    if (!boxCode.trim()) return;
    const r = await toast.call(
      registerReturn({ boxCode: boxCode.trim(), storeCode, condition, note: note || undefined }),
      '回收登记完成',
      (x) => x.message,
    );
    if (r) {
      setBoxCode('');
      setNote('');
      reload();
    }
  };

  return (
    <div>
      <div className="panel">
        <h2>门店回收登记</h2>
        <div className="hint">配送中心回收门店保温箱并登记箱况；箱体破裂直接记录报废去向，不进入清洗。在途箱不能重复回收。</div>
        <div className="grid cols-4">
          <label className="field">
            扫箱号
            <input placeholder="如 BX-1001" value={boxCode} onChange={(e) => setBoxCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
          </label>
          <label className="field">
            回收门店
            <select value={storeCode} onChange={(e) => setStoreCode(e.target.value)}>
              {stores.map((s) => <option key={s.id} value={s.code}>{s.name}</option>)}
            </select>
          </label>
          <label className="field">
            箱况
            <select value={condition} onChange={(e) => setCondition(e.target.value)}>
              <option value="INTACT">完好</option>
              <option value="DIRTY">有污渍</option>
              <option value="DAMAGED">箱体破裂</option>
            </select>
          </label>
          <label className="field">
            备注
            <input placeholder="可选" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        </div>
        <div className="row end" style={{ marginTop: 12 }}>
          <button className="btn" onClick={submit}>📷 扫码登记回收</button>
        </div>
      </div>

      <div className="panel">
        <h2>已回收到 DC · 待清洗队列</h2>
        <table>
          <thead><tr><th>箱号</th><th>状态</th><th>当前位置</th><th>上次使用门店</th></tr></thead>
          <tbody>
            {(boxes || []).map((b) => (
              <tr key={b.id}>
                <td className="mono">{b.code}</td>
                <td><BoxStatusTag status={b.status} /></td>
                <td>配送中心 DC</td>
                <td>{b.lastStore?.name ?? '—'}</td>
              </tr>
            ))}
            {!boxes?.length && <tr><td colSpan={4}><div className="empty">待清洗队列为空</div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
