const BASE = '/api';

async function req(path: string, options?: RequestInit) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = Array.isArray(data.message) ? data.message.join('；') : data.message;
    throw new Error(msg || `请求失败（HTTP ${res.status}）`);
  }
  return data;
}

export const api = {
  get: (path: string) => req(path),
  post: (path: string, body?: unknown) => req(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
};
