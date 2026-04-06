import { NavLink } from "react-router-dom";

export default function PublicSiteHeader({ onInstallClick }) {
  return (
    <header className="marketing-header">
      <div className="marketing-header-inner">
        <NavLink to="/" end className="marketing-logo" aria-label="BundleCart home">
          <img src="/logo.png" alt="BundleCart" />
          <span>BundleCart</span>
        </NavLink>
        <nav className="marketing-main-nav" aria-label="Primary navigation">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `marketing-main-nav-link ${isActive ? "marketing-main-nav-link-active" : ""}`
            }
          >
            Home
          </NavLink>
          <NavLink
            to="/blog"
            className={({ isActive }) =>
              `marketing-main-nav-link ${isActive ? "marketing-main-nav-link-active" : ""}`
            }
          >
            Blog
          </NavLink>
        </nav>
        <button
          type="button"
          className="marketing-btn marketing-btn-primary marketing-cta"
          onClick={onInstallClick}
          title="Install BundleCart"
        >
          Install BundleCart
        </button>
      </div>
    </header>
  );
}
