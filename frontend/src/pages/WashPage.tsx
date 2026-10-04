import { useState } from 'react';
import { createBatch, finishBatch, inspect, listBatches, scanIntoBatch } from '../api';
import { useMeta } from '../meta';
import { BoxStatusTag, ScanInput, usePoll, useToast } from '../ui';
import { failReasonsText } from '../status-labels';

// 清洗批次 + 质检
export function WashPage() {
  const toast = useToast();
  const { staff } = useMeta();
  const washers = staff.filter((s) => s.role.includes('WASHER'));
  const inspectors = staff.filter((s) => s.role.includes('INSPECTOR'));

  const [washerCode, setWasherCode] = useState(washers[0]?.code || 'W01');
  const [activeBatch, setActiveBatch] = useState<number | null>(null);
  const { data: batches, reload } = usePoll(() => listBatches(), [], 3000);

  // 质检表单（按箱一行展开）
  const [inspectorCode, setInspectorCode] = useState(
    inspectors.find((s) => !s.role.includes('WASHER'))?.code || inspectors[0]?.code || 'Q01',
  );
  const [qcChecks, setQcChecks] = useState<Record<number, { residueFree: boolean; dry: boolean; intact: boolean }>>({});

  const getChecks = (wrId: number) => qcChecks[wrId] || { residueFree: true, dry: true, intact: true };
  const setCheck = (wrId: number, k: 'residueFree' | 'dry' | 'intact', v: boolean) =>
    setQcChecks((m) => ({ ...m, [wrId]: { ...getChecks(wrId), [k]: v } }));

  const sorted = [...(batches || [])].sort((a, b) => Number(b.status === 'OPEN') - Number(a.status === 'OPEN'));

  return (
    <div>
      <div className="panel">
        <h2>清洗消毒批次</h2>
        <div className="hint">
          建批后扫码把箱子关联到消毒批次；同一箱重复扫描不会重复入批。质检须由非本批清洗员执行（岗位回避），
          三项全部合格才可出库。
        </div>
        <div className="row">
          <label className="field" style={{ minWidth: 220 }}>
            清洗员
            <select value={washerCode} onChange={(e) => setWasherCode(e.target.value)}>
              {washers.map((w) => <option key={w.id} value={w.code}>{w.name}（{w.code}）</option>)}
            </select>
          </label>
          <button
            className="btn"
            onClick={async () => {
              const b = await toast.call(createBatch(washerCode), '批次已创建', (x) => x.batchNo);
              if (b) {
                setActiveBatch(b.id);
                reload();
              }
            }}
          >
            新建清洗批次
          </button>
        </div>

        {activeBatch && (
          <div style={{ marginTop: 14 }}>
            <ScanInput
              placeholder={`扫描箱号加入当前批次 #${activeBatch}`}
              buttonText="入批"
              onScan={async (code) => {
                const r = await toast.call(scanIntoBatch(activeBatch, code), '扫描入批成功', (x) => x.message);
                if (r) reload();
              }}
            />
          </div>
        )}
      </div>

      {sorted.map((batch) => {
        const isActive = activeBatch === batch.id;
        return (
          <div className="panel" key={batch.id} style={isActive ? { borderColor: 'var(--primary)', boxShadow: '0 0 0 3px var(--primary-soft)' } : undefined}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="mono">{batch.batchNo}</span>
                  <span className={`tag ${batch.status === 'OPEN' ? 'amber' : 'gray'}`}>
                    {batch.status === 'OPEN' ? '开放中' : '已封批'}
                  </span>
                  {isActive && <span className="tag blue">当前扫码批次</span>}
                </h2>
                <div className="hint" style={{ marginBottom: 0 }}>
                  清洗员：{batch.washer.name} · 消毒剂：{batch.detergent} · {batch.washRecords.length} 只箱
                </div>
              </div>
              <div className="row">
                {batch.status === 'OPEN' && (
                  <>
                    <button className="btn secondary sm" onClick={() => setActiveBatch(isActive ? null : batch.id)}>
                      {isActive ? '取消选中' : '选为扫码批次'}
                    </button>
                    <button
                      className="btn sm green"
                      onClick={async () => {
                        const r = await toast.call(finishBatch(batch.id), '批次已封批');
                        if (r) {
                          if (isActive) setActiveBatch(null);
                          reload();
                        }
                      }}
                    >
                      封批
                    </button>
                  </>
                )}
              </div>
            </div>

            <table style={{ marginTop: 10 }}>
              <thead>
                <tr>
                  <th>箱号</th><th>箱状态</th><th>质检结论</th>
                  <th style={{ minWidth: 300 }}>质检员确认（无残留 / 已干燥 / 箱体完好）</th>
                </tr>
              </thead>
              <tbody>
                {batch.washRecords.map((wr) => {
                  const c = getChecks(wr.id);
                  return (
                    <tr key={wr.id}>
                      <td className="mono">{wr.box.code}</td>
                      <td><BoxStatusTag status={wr.box.status} /></td>
                      <td>
                        {wr.inspection ? (
                          wr.inspection.passed ? (
                            <span className="pass">✓ 合格 · {wr.inspection.inspector.name}</span>
                          ) : (
                            <span className="fail">✗ {failReasonsText(wr.inspection.failReasons)}</span>
                          )
                        ) : (
                          <span className="muted">待质检</span>
                        )}
                      </td>
                      <td>
                        {wr.inspection ? (
                          <span className="muted">
                            {[wr.inspection.residueFree && '无残留', wr.inspection.dry && '已干燥', wr.inspection.intact && '完好']
                              .filter(Boolean)
                              .join(' · ') || '三项均不达标'}
                          </span>
                        ) : (
                          <div className="row">
                            <div className="checks">
                              <label><input type="checkbox" checked={c.residueFree} onChange={(e) => setCheck(wr.id, 'residueFree', e.target.checked)} /> 无残留</label>
                              <label><input type="checkbox" checked={c.dry} onChange={(e) => setCheck(wr.id, 'dry', e.target.checked)} /> 已干燥</label>
                              <label><input type="checkbox" checked={c.intact} onChange={(e) => setCheck(wr.id, 'intact', e.target.checked)} /> 箱体完好</label>
                            </div>
                            <select
                              value={inspectorCode}
                              onChange={(e) => setInspectorCode(e.target.value)}
                              style={{ width: 150 }}
                              title="质检员（清洗员不能质检自己的批次）"
                            >
                              {inspectors.map((q) => <option key={q.id} value={q.code}>{q.name}</option>)}
                            </select>
                            <button
                              className="btn sm"
                              onClick={async () => {
                                const r = await toast.call(
                                  inspect({
                                    batchId: batch.id,
                                    boxCode: wr.box.code,
                                    inspectorCode,
                                    residueFree: c.residueFree,
                                    dry: c.dry,
                                    intact: c.intact,
                                  }),
                                  c.residueFree && c.dry && c.intact ? '质检合格' : '质检不合格已隔离',
                                  (x) => x.message,
                                );
                                if (r) reload();
                              }}
                            >
                              提交质检
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!batch.washRecords.length && (
                  <tr><td colSpan={4}><div className="empty">空批次</div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
