import { listDispositions } from '../api';
import { usePoll } from '../ui';
import { ACTION_LABEL, SOURCE_LABEL, FAIL_REASON_LABEL } from '../status-labels';

const ACTION_COLOR: Record<string, string> = { SCRAP: 'red', REWASH: 'amber', RETURN_DC: 'blue' };

export function DispositionsPage({ openBox }: { openBox: (id: number) => void }) {
  const { data: list } = usePoll(() => listDispositions(), [], 5000);
  return (
    <div className="panel">
      <h2>异常处理去向</h2>
      <div className="hint">箱体破裂、清洗剂残留/未干燥、门店拒收三类异常均在此留痕：报废 / 返洗 / 退回 DC。</div>
      <table>
        <thead>
          <tr><th>时间</th><th>箱号</th><th>来源</th><th>原因</th><th>处理去向</th><th>说明</th></tr>
        </thead>
        <tbody>
          {(list || []).map((d) => (
            <tr key={d.id}>
              <td className="muted">{new Date(d.createdAt).toLocaleString('zh-CN')}</td>
              <td className="mono"><a style={{ cursor: 'pointer' }} onClick={() => openBox(d.boxId)}>{d.box.code}</a></td>
              <td>{SOURCE_LABEL[d.source] || d.source}</td>
              <td>
                {d.reason
                  .split(',')
                  .map((r) => FAIL_REASON_LABEL[r] || r)
                  .join('、')}
              </td>
              <td><span className={`tag ${ACTION_COLOR[d.action] || 'gray'}`}>{ACTION_LABEL[d.action] || d.action}</span></td>
              <td className="muted">{d.note}</td>
            </tr>
          ))}
          {!list?.length && <tr><td colSpan={6}><div className="empty">暂无异常处理记录</div></td></tr>}
        </tbody>
      </table>
    </div>
  );
}
