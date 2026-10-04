export interface Store {
  id: number;
  code: string;
  name: string;
}

export interface Staff {
  id: number;
  code: string;
  name: string;
  role: string;
}

export interface DispositionItem {
  id: number;
  reason: string;
  action: string;
  source: string;
  note: string | null;
  createdAt: string;
}

export interface LocationEventItem {
  id: number;
  action: string;
  note: string | null;
  createdAt: string;
  store: Store | null;
}

export interface Box {
  id: number;
  code: string;
  spec: string;
  status: string;
  currentStoreId: number | null;
  lastStoreId: number | null;
  activeHandoverId: number | null;
  currentStore: Store | null;
  lastStore: Store | null;
  activeHandover?: Handover | null;
  dispositions?: DispositionItem[];
  locEvents?: LocationEventItem[];
}

export interface WashBatch {
  id: number;
  batchNo: string;
  washerId: number;
  detergent: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  washer: Staff;
  washRecords: Array<{
    id: number;
    boxId: number;
    box: Box;
    inspection: {
      id: number;
      passed: boolean;
      failReasons: string;
      residueFree: boolean;
      dry: boolean;
      intact: boolean;
      inspector: Staff;
    } | null;
  }>;
}

export interface Handover {
  id: number;
  handoverNo: string;
  boxId: number;
  targetStoreId: number;
  driverId: number;
  status: string;
  rejectReason: string | null;
  shippedAt: string;
  closedAt: string | null;
  box?: Box;
  targetStore: Store;
  driver: Staff;
}

export interface Disposition {
  id: number;
  boxId: number;
  reason: string;
  action: string;
  source: string;
  note: string | null;
  createdAt: string;
  box: Box;
}

export interface AppNotification {
  id: number;
  level: string;
  type: string;
  title: string;
  message: string;
  boxCode: string | null;
  read: boolean;
  createdAt: string;
}

export interface BoxDetail {
  box: Box;
  lastStore: Store | null;
  latestWash: {
    id: number;
    washedAt: string;
    batch: { batchNo: string; washer: Staff };
    inspection: {
      passed: boolean;
      failReasons: string;
      residueFree: boolean;
      dry: boolean;
      intact: boolean;
      inspector: Staff;
      inspectedAt: string;
    } | null;
  } | null;
  activeHandover: Handover | null;
  recentReturns: Array<{
    id: number;
    condition: string;
    note: string | null;
    scannedAt: string;
    store: Store;
  }>;
  box_locEvents?: unknown;
}
