import { createContext, useContext } from 'react';
import type { Staff, Store } from './types';

export interface Meta {
  stores: Store[];
  staff: Staff[];
}

export const MetaContext = createContext<Meta>({ stores: [], staff: [] });
export const useMeta = () => useContext(MetaContext);

export const roleLabel = (role: string) =>
  role
    .split(',')
    .map((r) => ({ WASHER: '清洗员', INSPECTOR: '质检员', DRIVER: '配送员' }[r] || r))
    .join('/');
