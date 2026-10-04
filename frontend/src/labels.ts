export const STATUS_LABELS: Record<string, string> = {
  AT_STORE: '在门店',
  RETURNED: '已退回待清洗',
  WASHING: '清洗中',
  PENDING_QC: '待质检',
  AVAILABLE: '可用',
  IN_TRANSIT: '出库在途',
  QUARANTINE: '隔离维修',
  SCRAPPED: '已报废',
};

export const CONDITION_LABELS: Record<string, string> = {
  GOOD: '完好',
  CRACKED: '箱体破裂',
  DIRTY: '污渍残留',
};

export const ROLE_LABELS: Record<string, string> = {
  CLEANER: '清洗员',
  QC: '质检员',
  DRIVER: '配送员',
  CLERK: '门店店员',
  ADMIN: '管理员',
};

export const DISPOSITION_LABELS: Record<string, string> = {
  REWASH: '退回重洗',
  REPAIR: '隔离维修',
  SCRAP: '报废',
};

export const SHIPMENT_STATUS_LABELS: Record<string, string> = {
  IN_TRANSIT: '在途',
  COMPLETED: '已签收',
  PARTIAL: '部分签收',
};

export const EVENT_LABELS: Record<string, string> = {
  RETURNED: '门店退回',
  WASH_STARTED: '开始清洗',
  WASH_COMPLETED: '清洗完成',
  QC_PASSED: '质检合格',
  QC_FAILED: '质检不合格',
  OUTBOUND: '出库',
  SIGNED: '门店签收',
  REJECTED: '门店拒收',
};

export function fmtTime(t?: string) {
  if (!t) return '-';
  return new Date(t).toLocaleString('zh-CN', { hour12: false });
}
