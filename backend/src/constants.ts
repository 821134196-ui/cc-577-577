export const BOX_STATUS = {
  IN_USE: 'IN_USE', // 在门店使用中
  RETURNED: 'RETURNED', // 已回收到 DC，待清洗
  WASHING: 'WASHING', // 清洗中
  AVAILABLE: 'AVAILABLE', // 质检合格，可出库
  QUARANTINED: 'QUARANTINED', // 质检不合格，隔离
  IN_TRANSIT: 'IN_TRANSIT', // 调拨在途
  AT_STORE: 'AT_STORE', // 门店已签收
  SCRAPPED: 'SCRAPPED', // 报废
} as const;

export const BOX_STATUS_LABEL: Record<string, string> = {
  IN_USE: '门店使用中',
  RETURNED: 'DC待清洗',
  WASHING: '清洗中',
  AVAILABLE: '合格可出库',
  QUARANTINED: '质检隔离',
  IN_TRANSIT: '调拨在途',
  AT_STORE: '门店已签收',
  SCRAPPED: '已报废',
};

export const CONDITION_LABEL: Record<string, string> = {
  INTACT: '完好',
  DIRTY: '有污渍',
  DAMAGED: '箱体破裂',
};

export const FAIL_REASON_LABEL: Record<string, string> = {
  RESIDUE: '清洗剂残留',
  NOT_DRY: '未干燥',
  DAMAGE: '箱体破裂',
};

export const HANDOVER_LABEL: Record<string, string> = {
  IN_TRANSIT: '配送在途',
  SIGNED: '门店签收',
  REJECTED: '门店拒收',
};
