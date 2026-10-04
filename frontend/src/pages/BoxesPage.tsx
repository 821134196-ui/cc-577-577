import { useState } from 'react';
import { createBox, listBoxes } from '../api';
import { BoxStatusTag, Modal, ScanInput, usePoll, useToast } from '../ui';
import { BoxDetailView } from './BoxDetail';
import { boxDetail } from '../api';
import type { BoxDetail } from '../types';

export function BoxesPage({ openBox }: { openBox?: (id: number) => void }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [newCode, setNewCode] = useState('');
  const { data: boxes, reload } = usePoll(() => listBoxes(q), [q], 4000);
  const [detail, setDetail] = useState<BoxDetail | null>(null);

  const showDetail = async (id: number) => {
    const d = await boxDetail(id);
    setDetail(d);
  };

  return (
    <div>
      <div className="panel">
        <h2>保温箱档案与箱号查询</h2>
        <div className="hint">一箱一码，箱号全局唯一；门店可在此查询所收箱子的回收、清洗质检与交接记录。</div>
        <div className="row">
          <ScanInput placeholder="扫描/输入箱号查询，如 BX-1001" buttonText="查询" onScan={(c) => setQ(c)} />
          {q && (
            <button className="btn secondary sm" onClick={() => setQ('')}>清除查询</button>
          )}
          <div style={{ flex: 1 }} />
          <input
            placeholder="新箱建档：输入箱号"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            style={{ width: 200 }}
          />
          <button
            className="btn"
            onClick={async () => {
              if (!newCode.trim()) return;
              const r = await toast.call(createBox(newCode.trim()), '建档成功', (b) => `箱 ${b.code} 已建档`);
              if (r) {
                setNewCode('');
                reload();
              }
            }}
          >
            新箱建档
          </button>
        </div>
      </div>

      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>箱号</th><th>规格</th><th>状态</th><th>当前位置</th><th>上次使用门店</th><th>在途交接</th><th></th>
            </tr>
          </thead>
          <tbody>
            {(boxes || []).map((b) => (
              <tr key={b.id}>
                <td className="mono">{b.code}</td>
                <td>{b.spec}</td>
                <td><BoxStatusTag status={b.status} /></td>
                <td>{b.currentStore ? b.currentStore.name : <span className="muted">配送中心 DC</span>}</td>
                <td>{b.lastStore?.name ?? <span className="muted">—</span>}</td>
                <td>
                  {b.activeHandover ? (
                    <span className="tag amber">→ {b.activeHandover.targetStore?.name}</span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>
                  <button className="btn secondary sm" onClick={() => (openBox ? openBox(b.id) : showDetail(b.id))}>详情</button>
                </td>
              </tr>
            ))}
            {!boxes?.length && (
              <tr><td colSpan={7}><div className="empty">{q ? `未找到箱号 ${q}` : '暂无箱子'}</div></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {detail && !openBox && (
        <Modal title={`箱子详情 · ${detail.box.code}`} onClose={() => setDetail(null)} wide>
          <BoxDetailView data={detail} />
        </Modal>
      )}
    </div>
  );
}
