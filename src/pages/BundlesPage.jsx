import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { formatDateTime } from "./adminUtils";

const ONE_MINUTE_MS = 60 * 1000;
const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
const FIRST_ORDER_FEE_USD = 5;

function toArray(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload?.bundles)) {
    return payload.bundles;
  }
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }
  return [];
}

function normalizeBundle(bundle) {
  return {
    ...bundle,
    status: bundle.bundle_status || "OPEN",
    orderCount: Number(bundle.order_count || 0)
  };
}

function formatTimeRemaining(activeUntil) {
  if (!activeUntil) {
    return { label: "N/A", tone: "neutral" };
  }

  const expiresAt = new Date(activeUntil).getTime();
  if (Number.isNaN(expiresAt)) {
    return { label: "N/A", tone: "neutral" };
  }

  const remainingMs = expiresAt - Date.now();
  if (remainingMs <= 0) {
    return { label: "Expired", tone: "expired" };
  }

  const totalMinutes = Math.floor(remainingMs / ONE_MINUTE_MS);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return {
    label: `${hours}h ${minutes}m`,
    tone: remainingMs < ONE_DAY_MS ? "warning" : "neutral"
  };
}

function getRemainingTimeMs(activeUntil, nowMs) {
  if (!activeUntil) {
    return null;
  }
  const expiresAt = new Date(activeUntil).getTime();
  if (Number.isNaN(expiresAt)) {
    return null;
  }
  return expiresAt - nowMs;
}

function compareBundlesByUrgency(a, b, nowMs) {
  const aRemaining = getRemainingTimeMs(a.active_until, nowMs);
  const bRemaining = getRemainingTimeMs(b.active_until, nowMs);

  const aExpired = aRemaining !== null && aRemaining <= 0;
  const bExpired = bRemaining !== null && bRemaining <= 0;

  if (aExpired !== bExpired) {
    return aExpired ? -1 : 1;
  }
  if (aExpired && bExpired) {
    return aRemaining - bRemaining;
  }
  if (aRemaining === null && bRemaining === null) {
    return Number(a.id || 0) - Number(b.id || 0);
  }
  if (aRemaining === null) {
    return 1;
  }
  if (bRemaining === null) {
    return -1;
  }
  return aRemaining - bRemaining;
}

function formatMoney(value) {
  return `$${value.toFixed(2)}`;
}

export default function BundlesPage() {
  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    console.log("BUNDLE DASHBOARD PAGE LOAD");
    let mounted = true;

    api
      .getAdminBundles()
      .then((payload) => {
        if (!mounted) {
          return;
        }
        setBundles(toArray(payload).map(normalizeBundle));
      })
      .catch((requestError) => {
        if (!mounted) {
          return;
        }
        setError(requestError.message || "Failed to load bundles");
      })
      .finally(() => {
        if (!mounted) {
          return;
        }
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const metrics = useMemo(() => {
    const totalBundles = bundles.length;
    const totalOrders = bundles.reduce((sum, bundle) => sum + bundle.orderCount, 0);
    const activeBundles = bundles.filter((bundle) => bundle.status === "OPEN").length;
    const linkedFreeOrders = bundles.reduce(
      (sum, bundle) => sum + Math.max(bundle.orderCount - 1, 0),
      0
    );
    const firstOrderBundleFeesCollected = bundles.reduce((sum, bundle) => {
      return sum + (bundle.orderCount > 0 ? FIRST_ORDER_FEE_USD : 0);
    }, 0);

    return {
      activeBundles,
      totalBundles,
      linkedFreeOrders,
      firstOrderBundleFeesCollected,
      averageOrdersPerBundle: totalBundles > 0 ? totalOrders / totalBundles : 0
    };
  }, [bundles]);

  const filteredBundles = useMemo(() => {
    const nowMs = Date.now();
    const search = query.trim().toLowerCase();
    const matchingBundles = bundles.filter((bundle) => {
      if (!search) {
        return true;
      }
      return String(bundle.id || "")
        .toLowerCase()
        .includes(search);
    });

    return matchingBundles.slice().sort((a, b) => compareBundlesByUrgency(a, b, nowMs));
  }, [bundles, query]);

  return (
    <div className="page">
      <div className="page-header">
        <h3>Bundles</h3>
      </div>

      <div className="stats-grid stats-grid-small">
        <article className="card stat-card">
          <p>Active Bundles</p>
          <strong>{metrics.activeBundles}</strong>
        </article>
        <article className="card stat-card">
          <p>Total Bundles</p>
          <strong>{metrics.totalBundles}</strong>
        </article>
        <article className="card stat-card">
          <p>Linked Free Orders</p>
          <strong>{metrics.linkedFreeOrders}</strong>
        </article>
        <article className="card stat-card">
          <p>First-Order BundleCart Fees Collected</p>
          <strong>{formatMoney(metrics.firstOrderBundleFeesCollected)}</strong>
        </article>
        <article className="card stat-card">
          <p>Average Orders Per Bundle</p>
          <strong>{metrics.averageOrdersPerBundle.toFixed(2)}</strong>
        </article>
      </div>

      <div className="card">
        <div className="card-header-inline">
          <h4>Bundle Windows</h4>
          <input
            className="admin-search-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by bundle id"
          />
        </div>

        {loading ? <p>Loading bundles...</p> : null}
        {!loading && error ? <p className="inline-error">{error}</p> : null}
        {!loading && !error && filteredBundles.length === 0 ? (
          <p className="empty-state">No bundles match the current search.</p>
        ) : null}

        {!loading && !error && filteredBundles.length > 0 ? (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Bundle ID</th>
                  <th>Order Count</th>
                  <th>First Bundle Fee</th>
                  <th>Bundle Started</th>
                  <th>Bundle Expires</th>
                  <th>Time Remaining</th>
                </tr>
              </thead>
              <tbody>
                {filteredBundles.map((bundle) => {
                  const timeRemaining = formatTimeRemaining(bundle.active_until);
                  const firstBundleFee = bundle.orderCount > 0 ? FIRST_ORDER_FEE_USD : 0;
                  return (
                    <tr key={bundle.id} className="clickable-row">
                      <td>
                        <Link to={`/admin/bundles/${bundle.id}`} className="row-link">
                          {bundle.id}
                        </Link>
                      </td>
                      <td>{bundle.orderCount}</td>
                      <td>{formatMoney(firstBundleFee)}</td>
                      <td>{formatDateTime(bundle.bundlecart_paid_at)}</td>
                      <td>{formatDateTime(bundle.active_until)}</td>
                      <td>
                        <span className={`time-remaining-pill time-remaining-${timeRemaining.tone}`}>
                          {timeRemaining.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
