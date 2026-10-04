import { useState } from 'react';

/** 本地模拟扫码枪：输入箱号回车即“扫描” */
export default function ScanInput({
  placeholder = '扫描或输入箱号，如 BX-0005',
  buttonText = '扫描',
  onScan,
  disabled,
}: {
  placeholder?: string;
  buttonText?: string;
  disabled?: boolean;
  onScan: (code: string) => void;
}) {
  const [code, setCode] = useState('');
  const submit = () => {
    const c = code.trim().toUpperCase();
    if (!c) return;
    onScan(c);
    setCode('');
  };
  return (
    <div className="scan-input">
      <input
        value={code}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />
      <button className="btn primary" onClick={submit} disabled={disabled}>
        {buttonText}
      </button>
    </div>
  );
}
