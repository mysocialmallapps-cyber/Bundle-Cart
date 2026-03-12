import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { formatDateTime, getCustomerName, parseMaybeJson } from "./adminUtils";

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
  const customerAddress = parseMaybeJson(bundle.customer_address_json);
  return {
    ...bundle,
    customerAddress,
    customerName: getCustomerName(customerAddress),
    customerEmail: bundle.email || customerAddress.email || "",
    customerCity: customerAddress.city || "",
    customerCountry: customerAddress.country || customerAddress.country_code || "",
    warehouseRegion: bundle.warehouse_region || "N/A",
    status: bundle.bundle_status || "OPEN",
    orderCount: Number(bundle.order_count || 0)
  };
}

export default function AdminBundlesPage() {
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
    const openBundles = bundles.filter((bundle) => bundle.status === "OPEN").length;
    const readyBundles = bundles.filter((bundle) => bundle.status === "READY_TO_SHIP").length;
    const totalOrders = bundles.reduce((sum, bundle) => sum + bundle.orderCount, 0);
    return {
      openBundles,
      readyBundles,
      totalBundles: bundles.length,
      totalOrders
    };
  }, [bundles]);

  const filteredBundles = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) {
      return bundles;
    }
    return bundles.filter((bundle) => {
      const haystacks = [
        String(bundle.id || ""),
        String(bundle.customerEmail || ""),
        String(bundle.customerCity || ""),
        String(bundle.warehouseRegion || "")
      ]
        .join(" ")
        .toLowerCase();
      return haystacks.includes(search);
    });
  }, [bundles, query]);

  return (
    <div className="page">
      <div className="page-header">
        <h3>Operations / Bundles</h3>
      </div>

      <div className="stats-grid stats-grid-small">
        <article className="card stat-card">
          <p>Open Bundles</p>
          <strong>{metrics.openBundles}</strong>
        </article>
        <article className="card stat-card">
          <p>Ready to Ship Bundles</p>
          <strong>{metrics.readyBundles}</strong>
        </article>
        <article className="card stat-card">
          <p>Total Bundles</p>
          <strong>{metrics.totalBundles}</strong>
        </article>
        <article className="card stat-card">
          <p>Total Orders in Bundles</p>
          <strong>{metrics.totalOrders}</strong>
        </article>
      </div>

      <div className="card">
        <div className="card-header-inline">
          <h4>Bundle Operations Queue</h4>
          <input
            className="admin-search-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by bundle id, customer email, city, warehouse region"
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
                  <th>Status</th>
                  <th>Customer Name</th>
                  <th>Customer Email</th>
                  <th>Customer City</th>
                  <th>Customer Country</th>
                  <th>Orders in Bundle</th>
                  <th>Warehouse Region</th>
                  <th>Bundle Opened</th>
                  <th>Bundle Expires</th>
                </tr>
              </thead>
              <tbody>
                {filteredBundles.map((bundle) => (
                  <tr key={bundle.id} className="clickable-row">
                    <td>
                      <Link to={`/admin/bundles/${bundle.id}`} className="row-link">
                        {bundle.id}
                      </Link>
                    </td>
                    <td>
                      <span
                        className={`status-pill ${
                          bundle.status === "READY_TO_SHIP" ? "status-ready" : "status-open"
                        }`}
                      >
                        {bundle.status}
                      </span>
                    </td>
                    <td>{bundle.customerName}</td>
                    <td>{bundle.customerEmail || "N/A"}</td>
                    <td>{bundle.customerCity || "N/A"}</td>
                    <td>{bundle.customerCountry || "N/A"}</td>
                    <td>{bundle.orderCount}</td>
                    <td>{bundle.warehouseRegion}</td>
                    <td>{formatDateTime(bundle.bundlecart_paid_at)}</td>
                    <td>{formatDateTime(bundle.active_until)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
