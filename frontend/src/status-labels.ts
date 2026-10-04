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

export const HANDOVER_COLOR: Record<string, string> = {
  IN_TRANSIT: 'amber',
  SIGNED: 'green',
  REJECTED: 'red',
};

export const ACTION_LABEL: Record<string, string> = {
  SCRAP: '报废',
  REWASH: '返洗',
  RETURN_DC: '退回DC',
};

export const SOURCE_LABEL: Record<string, string> = {
  RETURN: '回收登记',
  INSPECTION: '质检',
  STORE_REJECT: '门店拒收',
};

export const failReasonsText = (s: string) =>
  s
    .split(',')
    .filter(Boolean)
    .map((r) => FAIL_REASON_LABEL[r] || r)
    .join('、');
