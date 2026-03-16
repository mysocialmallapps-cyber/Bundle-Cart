import { NavLink, Navigate, Route, Routes, useLocation, useSearchParams } from "react-router-dom";
import BundlesPage from "./pages/BundlesPage";
import AdminBundleDetailPage from "./pages/AdminBundleDetailPage";
import MerchantDashboardPage from "./pages/MerchantDashboardPage";
import PublicBundlePage from "./pages/PublicBundlePage";
import MarketingPage from "./pages/MarketingPage";

export default function App() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const shop = String(searchParams.get("shop") || "")
    .trim()
    .toLowerCase();
  const isMerchantDashboard = location.pathname === "/dashboard";
  const isPublicBundlePage = location.pathname.startsWith("/bundle/");
  const isMarketingPage = location.pathname === "/marketing";
  const navItems = isMerchantDashboard
    ? [
        {
          to: shop ? `/dashboard?shop=${encodeURIComponent(shop)}` : "/dashboard",
          label: "Dashboard"
        }
      ]
    : [{ to: "/admin/bundles", label: "Bundles" }];

  if (isPublicBundlePage || isMarketingPage) {
    return (
      <main className="main">
        <section className="page-content">
          <Routes>
            <Route path="/bundle/:token" element={<PublicBundlePage />} />
            <Route path="/marketing" element={<MarketingPage />} />
          </Routes>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1 className="brand">BundleCart</h1>
        <p className="brand-subtitle">{isMerchantDashboard ? "Merchant View" : "Admin MVP"}</p>
        <nav className="nav">
          {navItems.map((item) => (
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
          <h2>{isMerchantDashboard ? "BundleCart Store Metrics" : "Bundle Network Operations"}</h2>
          <p>
            {isMerchantDashboard
              ? "Track bundles, incremental orders, and BundleCart network performance."
              : "Monitor active bundle windows, first-order fees, and linked free orders."}
          </p>
        </header>

        <section className="page-content">
          <Routes>
            <Route path="/" element={<Navigate to="/admin/bundles" replace />} />
            <Route path="/dashboard" element={<MerchantDashboardPage />} />
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
