import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import DashboardPage from "./pages/DashboardPage";
import BundlesPage from "./pages/BundlesPage";
import OrdersPage from "./pages/OrdersPage";
import CustomerInsightsPage from "./pages/CustomerInsightsPage";
import SettingsPage from "./pages/SettingsPage";
import AdminBundlesPage from "./pages/AdminBundlesPage";
import AdminBundleDetailPage from "./pages/AdminBundleDetailPage";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/bundles", label: "Bundle Management" },
  { to: "/orders", label: "Orders" },
  { to: "/insights", label: "Customer Insights" },
  { to: "/settings", label: "Settings & Integration" },
  { to: "/admin/bundles", label: "Operations Bundles" }
];

function Toast({ item }) {
  if (!item) {
    return null;
  }

  return (
    <div className={`toast toast-${item.type}`}>
      <strong>{item.type === "error" ? "Error" : "Success"}:</strong> {item.message}
    </div>
  );
}

export default function App() {
  const [toast, setToast] = useState(null);

  const notifier = useMemo(
    () => ({
      success(message) {
        setToast({ type: "success", message });
      },
      error(message) {
        setToast({ type: "error", message });
      }
    }),
    []
  );

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timer = window.setTimeout(() => setToast(null), 3400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1 className="brand">BundleCart</h1>
        <p className="brand-subtitle">Shopify Bundle Operations</p>
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
          <h2>Bundle Deals + Shipping Intelligence</h2>
          <p>Monitor bundles, orders, and customer eligibility in real time.</p>
        </header>

        <section className="page-content">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage notify={notifier} />} />
            <Route path="/bundles" element={<BundlesPage notify={notifier} />} />
            <Route path="/orders" element={<OrdersPage notify={notifier} />} />
            <Route path="/insights" element={<CustomerInsightsPage notify={notifier} />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/admin/bundles" element={<AdminBundlesPage />} />
            <Route path="/admin/bundles/:id" element={<AdminBundleDetailPage />} />
          </Routes>
        </section>
      </main>

      <Toast item={toast} />
    </div>
  );
}
