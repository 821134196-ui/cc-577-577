import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { BOX_STATUS_LABEL } from './status-labels';

// ---------- Toast（模拟本地通知浮层） ----------
type ToastKind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
}
interface ToastCtx {
  push: (kind: ToastKind, title: string, message?: string) => void;
  call: <T>(p: Promise<T>, okTitle: string, okMsg?: (r: T) => string) => Promise<T | null>;
}
const Ctx = createContext<ToastCtx>(null as unknown as ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const push = useCallback((kind: ToastKind, title: string, message?: string) => {
    const id = ++seq.current;
    setItems((xs) => [...xs, { id, kind, title, message }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 4200);
  }, []);

  // 包一层：自动弹成功/失败 toast，失败不外抛
  const call = useCallback(
    async <T,>(p: Promise<T>, okTitle: string, okMsg?: (r: T) => string) => {
      try {
        const r = await p;
        push('success', okTitle, okMsg ? okMsg(r) : undefined);
        return r;
      } catch (e: unknown) {
        push('error', '操作被拒绝', (e as Error).message);
        return null;
      }
    },
    [push],
  );

  return (
    <Ctx.Provider value={{ push, call }}>
      {children}
      <div className="toast">
        {items.map((x) => (
          <div key={x.id} className={`item ${x.kind}`}>
            <div className="t-title">{x.title}</div>
            {x.message && <div>{x.message}</div>}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);

// ---------- 通用状态标签 ----------
const STATUS_COLOR: Record<string, string> = {
  IN_USE: 'blue',
  RETURNED: 'gray',
  WASHING: 'amber',
  AVAILABLE: 'green',
  QUARANTINED: 'red',
  IN_TRANSIT: 'amber',
  AT_STORE: 'green',
  SCRAPPED: 'red',
};

export function BoxStatusTag({ status }: { status: string }) {
  return <span className={`tag ${STATUS_COLOR[status] || 'gray'}`}>{BOX_STATUS_LABEL[status] || status}</span>;
}

// ---------- 模拟扫码输入 ----------
export function ScanInput({
  placeholder,
  onScan,
  buttonText = '扫码',
  initial = '',
}: {
  placeholder: string;
  onScan: (code: string) => void;
  buttonText?: string;
  initial?: string;
}) {
  const [v, setV] = useState(initial);
  const fire = () => {
    const code = v.trim();
    if (code) onScan(code);
    setV('');
  };
  return (
    <div className="scan-box">
      <span className="scan-pulse" title="扫码器已连接（模拟）" />
      <input
        value={v}
        placeholder={placeholder}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && fire()}
        autoFocus
      />
      <button type="button" className="btn sm" onClick={fire}>
        📷 {buttonText}
      </button>
    </div>
  );
}

// ---------- 弹窗 ----------
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" style={wide ? { width: 860 } : undefined} onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="btn secondary sm" onClick={onClose}>关闭</button>
        </div>
        <div style={{ marginTop: 14 }}>{children}</div>
      </div>
    </div>
  );
}

// ---------- 轮询 ----------
export function usePoll<T>(fn: () => Promise<T>, deps: unknown[] = [], ms = 4000) {
  const [data, setData] = useState<T | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const reload = useCallback(() => {
    fnRef.current().then(setData).catch(() => undefined);
  }, []);
  useEffect(() => {
    reload();
    const t = setInterval(reload, ms);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, reload, setData };
}
