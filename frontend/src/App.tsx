import { NavLink, Route, Routes } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Boxes from './pages/Boxes';
import BoxDetail from './pages/BoxDetail';
import Returns from './pages/Returns';
import Wash from './pages/Wash';
import Qc from './pages/Qc';
import Shipments from './pages/Shipments';
import ShipmentDetail from './pages/ShipmentDetail';
import Notifications from './pages/Notifications';

const NAV = [
  { to: '/', label: '总览', end: true },
  { to: '/boxes', label: '保温箱' },
  { to: '/returns', label: '退回登记' },
  { to: '/wash', label: '清洗批次' },
  { to: '/qc', label: '质检' },
  { to: '/shipments', label: '调拨交接' },
  { to: '/notifications', label: '通知' },
];

export default function App() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon">❄</span>
          <div>
            <div className="brand-title">冷链保温箱</div>
            <div className="brand-sub">清洗批次与门店交接</div>
          </div>
        </div>
        <nav>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end as any} className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">本地演示环境 · 扫码/通知均为模拟</div>
      </aside>
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/boxes" element={<Boxes />} />
          <Route path="/boxes/:code" element={<BoxDetail />} />
          <Route path="/returns" element={<Returns />} />
          <Route path="/wash" element={<Wash />} />
          <Route path="/qc" element={<Qc />} />
          <Route path="/shipments" element={<Shipments />} />
          <Route path="/shipments/:id" element={<ShipmentDetail />} />
          <Route path="/notifications" element={<Notifications />} />
        </Routes>
      </main>
    </div>
  );
}
