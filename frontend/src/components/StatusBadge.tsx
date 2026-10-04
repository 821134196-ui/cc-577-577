import { STATUS_LABELS } from '../labels';

const COLORS: Record<string, string> = {
  AT_STORE: 'badge blue',
  RETURNED: 'badge amber',
  WASHING: 'badge cyan',
  PENDING_QC: 'badge purple',
  AVAILABLE: 'badge green',
  IN_TRANSIT: 'badge orange',
  QUARANTINE: 'badge red',
  SCRAPPED: 'badge gray',
};

export default function StatusBadge({ status }: { status: string }) {
  return <span className={COLORS[status] ?? 'badge gray'}>{STATUS_LABELS[status] ?? status}</span>;
}
