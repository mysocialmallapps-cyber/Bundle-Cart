import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import BundlesPage from "./pages/BundlesPage";
import AdminBundleDetailPage from "./pages/AdminBundleDetailPage";

const NAV_ITEMS = [{ to: "/admin/bundles", label: "Bundles" }];

export default function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1 className="brand">BundleCart</h1>
        <p className="brand-subtitle">Admin MVP</p>
        <nav className="nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item ${isActive ? "nav-item-active" : ""}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <h2>Bundle Network Operations</h2>
          <p>Monitor active bundle windows, first-order fees, and linked free orders.</p>
        </header>

        <section className="page-content">
          <Routes>
            <Route path="/" element={<Navigate to="/admin/bundles" replace />} />
            <Route path="/admin" element={<Navigate to="/admin/bundles" replace />} />
            <Route path="/admin/dashboard" element={<Navigate to="/admin/bundles" replace />} />
            <Route path="/admin/bundles" element={<BundlesPage />} />
            <Route path="/admin/bundles/:id" element={<AdminBundleDetailPage />} />
            <Route path="/admin/*" element={<Navigate to="/admin/bundles" replace />} />
          </Routes>
        </section>
      </main>
    </div>
  );
}
