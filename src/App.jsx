import { useEffect } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useSearchParams } from "react-router-dom";
import BundlesPage from "./pages/BundlesPage";
import AdminBundleDetailPage from "./pages/AdminBundleDetailPage";
import MerchantDashboardPage from "./pages/MerchantDashboardPage";
import PublicBundlePage from "./pages/PublicBundlePage";
import MarketingPage from "./pages/MarketingPage";
import BlogPage from "./pages/BlogPage";
import BlogPostPage from "./pages/BlogPostPage";
import { resolveLandingVariant } from "./lib/landingVariant";

export default function App() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const shop = String(searchParams.get("shop") || "")
    .trim()
    .toLowerCase();
  const embedded = String(searchParams.get("embedded") || "").trim() === "1";
  const host = String(searchParams.get("host") || "").trim();
  let isIframe = false;
  if (typeof window !== "undefined") {
    try {
      isIframe = window.top !== window.self;
    } catch {
      isIframe = true;
    }
  }
  const isEmbeddedMerchantContext = Boolean(shop && (embedded || host || isIframe));
  const isEmbeddedRootDashboard = location.pathname === "/" && isEmbeddedMerchantContext;
  const isHomepageMarketing = location.pathname === "/" && !isEmbeddedRootDashboard;
  const landingVariant = resolveLandingVariant({
    urlVariant: searchParams.get("variant"),
    persistInSession: isHomepageMarketing,
    pathname: location.pathname
  });
  const isMerchantDashboard = location.pathname === "/dashboard" || isEmbeddedRootDashboard;
  const isPublicBundlePage =
    location.pathname === "/bundle" || location.pathname.startsWith("/bundle/");
  const isBlogPage = location.pathname === "/blog" || location.pathname.startsWith("/blog/");
  const isMarketingPage =
    location.pathname === "/marketing" || (location.pathname === "/" && !isEmbeddedRootDashboard);
  const navItems = [{ to: "/admin/bundles", label: "Bundles" }];
  const showAdminChrome = !isMerchantDashboard;

  useEffect(() => {
    if (isHomepageMarketing && typeof console !== "undefined") {
      console.log("Landing variant:", landingVariant);
    }
  }, [isHomepageMarketing, landingVariant]);

  if (isPublicBundlePage || isMarketingPage || isBlogPage) {
    return (
      <main className="main">
        <section className="page-content">
          <Routes>
            <Route
              path="/"
              element={
                landingVariant === "repeat_purchase_v1" ? (
                  <MarketingPage variant="repeat_purchase_v1" />
                ) : (
                  <MarketingPage variant="control" />
                )
              }
            />
            <Route path="/blog" element={<BlogPage />} />
            <Route path="/blog/:slug" element={<BlogPostPage />} />
            <Route path="/bundle" element={<PublicBundlePage />} />
            <Route path="/bundle/:token" element={<PublicBundlePage />} />
            <Route path="/marketing" element={<MarketingPage />} />
          </Routes>
        </section>
      </main>
    );
  }

  return (
    <div className={`app-shell ${showAdminChrome ? "" : "app-shell-merchant"}`}>
      {showAdminChrome ? (
        <aside className="sidebar">
          <h1 className="brand">BundleCart</h1>
          <p className="brand-subtitle">Admin MVP</p>
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
      ) : null}

      <main className={`main ${isMerchantDashboard ? "main-merchant" : ""}`}>
        {showAdminChrome ? (
          <header className="topbar">
            <h2>Bundle Network Operations</h2>
            <p>Monitor active bundle windows, first-order fees, and linked free orders.</p>
          </header>
        ) : null}
        <section className="page-content">
          <Routes>
            <Route path="/" element={<MerchantDashboardPage />} />
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
