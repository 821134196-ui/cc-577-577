export const BoxStatus = {
  AT_STORE: 'AT_STORE',
  RETURNED: 'RETURNED',
  WASHING: 'WASHING',
  PENDING_QC: 'PENDING_QC',
  AVAILABLE: 'AVAILABLE',
  IN_TRANSIT: 'IN_TRANSIT',
  QUARANTINE: 'QUARANTINE',
  SCRAPPED: 'SCRAPPED',
} as const;

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

export const Condition = {
  GOOD: 'GOOD',
  CRACKED: 'CRACKED',
  DIRTY: 'DIRTY',
} as const;

export const CONDITION_LABELS: Record<string, string> = {
  GOOD: '完好',
  CRACKED: '箱体破裂',
  DIRTY: '污渍残留',
};

export const Role = {
  CLEANER: 'CLEANER',
  QC: 'QC',
  DRIVER: 'DRIVER',
  CLERK: 'CLERK',
  ADMIN: 'ADMIN',
} as const;

export const ROLE_LABELS: Record<string, string> = {
  CLEANER: '清洗员',
  QC: '质检员',
  DRIVER: '配送员',
  CLERK: '门店店员',
  ADMIN: '管理员',
};

export const Disposition = {
  REWASH: 'REWASH',
  REPAIR: 'REPAIR',
  SCRAP: 'SCRAP',
} as const;

export const DISPOSITION_LABELS: Record<string, string> = {
  REWASH: '退回重洗',
  REPAIR: '隔离维修',
  SCRAP: '报废',
};

export const DC_CODE = 'DC-000';
