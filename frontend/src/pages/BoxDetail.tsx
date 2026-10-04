import type { BoxDetail } from '../types';
import { BoxStatusTag } from '../ui';
import { CONDITION_LABEL, FAIL_REASON_LABEL, failReasonsText } from '../status-labels';

function kv(k: string, v: React.ReactNode) {
  return (
    <div>
      <span className="k">{k}：</span>
      {v}
    </div>
  );
}

const ACTION_LABEL: Record<string, string> = {
  RETURN: '门店回收',
  WASH: '入批清洗',
  OUTBOUND: '出库发运',
  SIGN: '门店签收',
  REJECT: '门店拒收',
  SCRAP: '判废',
};

export function BoxDetailView({ data }: { data: BoxDetail }) {
  const { box, lastStore, latestWash, activeHandover, recentReturns } = data;
  const events = box.locEvents ?? [];

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="detail-meta">
        {kv('箱号', <span className="mono">{box.code}</span>)}
        {kv('当前状态', <BoxStatusTag status={box.status} />)}
        {kv('当前位置', box.currentStore ? box.currentStore.name : <span className="muted">配送中心 DC / 在途</span>)}
        {kv('上次使用门店', lastStore ? lastStore.name : <span className="muted">—</span>)}
        {kv('规格', box.spec)}
        {kv(
          '本次交接',
          activeHandover ? (
            <>
              {activeHandover.handoverNo} → {activeHandover.targetStore.name}（配送员 {activeHandover.driver.name}）
            </>
          ) : (
            <span className="muted">无在途交接</span>
          ),
        )}
      </div>

      <div className="panel" style={{ marginBottom: 0 }}>
        <h2>最近一次清洗与质检</h2>
        {latestWash ? (
          <div className="detail-meta" style={{ marginTop: 8 }}>
            {kv('清洗批次', <span className="mono">{latestWash.batch.batchNo}</span>)}
            {kv('清洗员', latestWash.batch.washer.name)}
            {kv('清洗时间', new Date(latestWash.washedAt).toLocaleString('zh-CN'))}
            {kv(
              '质检结果',
              latestWash.inspection ? (
                latestWash.inspection.passed ? (
                  <span className="pass">✓ 合格（无残留 · 已干燥 · 箱体完好）</span>
                ) : (
                  <span className="fail">✗ 不合格：{failReasonsText(latestWash.inspection.failReasons)}</span>
                )
              ) : (
                <span className="muted">尚未质检</span>
              ),
            )}
            {latestWash.inspection && kv('质检员', latestWash.inspection.inspector.name)}
          </div>
        ) : (
          <div className="empty">暂无清洗记录</div>
        )}
      </div>

      <div className="grid cols-3">
        <div className="panel" style={{ marginBottom: 0 }}>
          <h2>处理去向</h2>
          {box.dispositions?.length ? (
            <table>
              <tbody>
                {box.dispositions.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <span className="tag red">{(FAIL_REASON_LABEL[d.reason.split(',')[0]] || d.reason)}</span>
                    </td>
                    <td>{d.action}</td>
                    <td className="muted">{d.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">无异常处理</div>
          )}
        </div>

        <div className="panel" style={{ marginBottom: 0 }}>
          <h2>近期回收登记</h2>
          {recentReturns.length ? (
            <table>
              <tbody>
                {recentReturns.map((r) => (
                  <tr key={r.id}>
                    <td>{r.store.name}</td>
                    <td>
                      <span className={`tag ${r.condition === 'DAMAGED' ? 'red' : 'gray'}`}>
                        {CONDITION_LABEL[r.condition]}
                      </span>
                    </td>
                    <td className="muted">{new Date(r.scannedAt).toLocaleDateString('zh-CN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">无回收记录</div>
          )}
        </div>

        <div className="panel" style={{ marginBottom: 0 }}>
          <h2>位置轨迹</h2>
          <div className="timeline">
            {events.map((e) => (
              <div key={e.id} className="ev">
                <div>
                  {ACTION_LABEL[e.action] || e.action}
                  {e.note ? ` · ${e.note}` : ''}
                </div>
                <div className="t">{new Date(e.createdAt).toLocaleString('zh-CN')}</div>
              </div>
            ))}
            {!events.length && <div className="empty">暂无轨迹</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
