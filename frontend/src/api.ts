import type {
  AppNotification,
  Box,
  BoxDetail,
  Disposition,
  Handover,
  Staff,
  Store,
  WashBatch,
} from './types';

const BASE = '/api';

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = data?.message || `请求失败（${res.status}）`;
    const err = new Error(Array.isArray(message) ? message.join('；') : message) as Error & {
      status: number;
    };
    err.status = res.status;
    throw err;
  }
  return data as T;
}

export const getMeta = () => api<{ stores: Store[]; staff: Staff[] }>('/meta');
export const listBoxes = (code = '', status = '') =>
  api<Box[]>(`/boxes?${new URLSearchParams({ code, status })}`);
export const createBox = (code: string) => api<Box>('/boxes', { method: 'POST', body: JSON.stringify({ code }) });
export const boxDetail = (id: number) => api<BoxDetail>(`/boxes/${id}`);

export const registerReturn = (body: { boxCode: string; storeCode: string; condition: string; note?: string }) =>
  api<{ disposition: string; message: string }>('/returns', { method: 'POST', body: JSON.stringify(body) });

export const createBatch = (washerCode: string) =>
  api<WashBatch>('/wash-batches', { method: 'POST', body: JSON.stringify({ washerCode }) });
export const listBatches = () => api<WashBatch[]>('/wash-batches');
export const scanIntoBatch = (batchId: number, boxCode: string) =>
  api<{ message: string }>(`/wash-batches/${batchId}/scan`, { method: 'POST', body: JSON.stringify({ boxCode }) });
export const finishBatch = (batchId: number) =>
  api(`/wash-batches/${batchId}/finish`, { method: 'POST' });

export const inspect = (body: {
  batchId: number;
  boxCode: string;
  inspectorCode: string;
  residueFree: boolean;
  dry: boolean;
  intact: boolean;
  note?: string;
}) =>
  api<{ passed: boolean; failReasons?: string[]; message: string }>('/inspections', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const createHandover = (body: { boxCode: string; targetStoreCode: string; driverCode: string }) =>
  api<Handover>('/handovers', { method: 'POST', body: JSON.stringify(body) });
export const listHandovers = () => api<Handover[]>('/handovers');
export const signHandover = (id: number) =>
  api<{ message: string }>(`/handovers/${id}/sign`, { method: 'POST' });
export const rejectHandover = (id: number, reason: string) =>
  api<{ message: string }>(`/handovers/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });

export const listDispositions = () => api<Disposition[]>('/dispositions');
export const listNotifications = () => api<AppNotification[]>('/notifications');
export const markRead = (id: number) => api(`/notifications/${id}/read`, { method: 'POST' });
export const resetDemo = () => api<{ ok: boolean; message: string }>('/admin/reset', { method: 'POST' });
