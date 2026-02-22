import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";

function toArray(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }
  return [];
}

function isTruthy(value) {
  return value === true || value === "true" || value === 1;
}

export default function DashboardPage({ notify }) {
  const [bundles, setBundles] = useState([]);
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const controller = new AbortController();
    try {
      setError("");
      const [bundleData, orderData, customerData] = await Promise.all([
        api.getBundles(controller.signal),
        api.getOrders(controller.signal),
        api.getCustomerInsights(controller.signal)
      ]);
      setBundles(toArray(bundleData));
      setOrders(toArray(orderData));
      setCustomers(toArray(customerData));
    } catch (requestError) {
      setError(requestError.message);
      notify.error("Unable to refresh dashboard data.");
    } finally {
      setLoading(false);
    }

    return () => controller.abort();
  }, [notify]);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 30000);
    return () => window.clearInterval(timer);
  }, [load]);

  const metrics = useMemo(() => {
    const activeBundles = bundles.filter((bundle) =>
      isTruthy(bundle.isActive ?? bundle.active ?? bundle.status === "active")
    ).length;
    const freeShippingTriggers = orders.filter((order) =>
      isTruthy(
        order.freeShippingTriggered ??
          order.qualifiesFreeShipping ??
          order.secondOrderFreeShippingApplied
      )
    ).length;
    const crossStoreOrders = orders.filter((order) =>
      isTruthy(order.crossStoreWithin24h ?? order.crossStoreEligible)
    ).length;
    const qualifiedCustomers = customers.filter((customer) =>
      isTruthy(customer.qualifiesFreeShipping ?? customer.qualifiesBundleDiscount)
    ).length;

    return {
      totalBundles: bundles.length,
      activeBundles,
      totalOrders: orders.length,
      freeShippingTriggers,
      crossStoreOrders,
      qualifiedCustomers
    };
  }, [bundles, customers, orders]);

  const latestOrderEvents = useMemo(
    () =>
      [...orders]
        .sort((a, b) => new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at))
        .slice(0, 6),
    [orders]
  );

  return (
    <div className="page">
      <div className="page-header">
        <h3>Home / Dashboard</h3>
        <button type="button" className="button button-secondary" onClick={load}>
          Refresh
        </button>
      </div>

      {error ? <p className="inline-error">{error}</p> : null}

      <div className="stats-grid">
        <article className="card stat-card">
          <p>Total Bundles</p>
          <strong>{metrics.totalBundles}</strong>
        </article>
        <article className="card stat-card">
          <p>Active Bundles</p>
          <strong>{metrics.activeBundles}</strong>
        </article>
        <article className="card stat-card">
          <p>Total Orders</p>
          <strong>{metrics.totalOrders}</strong>
        </article>
        <article className="card stat-card">
          <p>Free Shipping Triggers</p>
          <strong>{metrics.freeShippingTriggers}</strong>
        </article>
        <article className="card stat-card">
          <p>Cross-Store Orders (24h)</p>
          <strong>{metrics.crossStoreOrders}</strong>
        </article>
        <article className="card stat-card">
          <p>Qualified Customers</p>
          <strong>{metrics.qualifiedCustomers}</strong>
        </article>
      </div>

      <div className="card">
        <h4>Recent Shipping Trigger Events</h4>
        {loading ? <p>Loading dashboard data...</p> : null}
        {!loading && latestOrderEvents.length === 0 ? (
          <p className="empty-state">No order events available yet.</p>
        ) : null}
        {!loading && latestOrderEvents.length > 0 ? (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Store</th>
                  <th>Cross-Store 24h</th>
                  <th>Free Shipping</th>
                </tr>
              </thead>
              <tbody>
                {latestOrderEvents.map((order) => (
                  <tr key={order.id}>
                    <td>{order.orderNumber || order.id}</td>
                    <td>{order.customerName || order.customerEmail || "Unknown"}</td>
                    <td>{order.storeName || order.store || "N/A"}</td>
                    <td>
                      <span
                        className={`status-pill ${
                          isTruthy(order.crossStoreWithin24h ?? order.crossStoreEligible)
                            ? "status-ok"
                            : "status-neutral"
                        }`}
                      >
                        {isTruthy(order.crossStoreWithin24h ?? order.crossStoreEligible) ? "Yes" : "No"}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`status-pill ${
                          isTruthy(
                            order.freeShippingTriggered ??
                              order.qualifiesFreeShipping ??
                              order.secondOrderFreeShippingApplied
                          )
                            ? "status-ok"
                            : "status-neutral"
                        }`}
                      >
                        {isTruthy(
                          order.freeShippingTriggered ??
                            order.qualifiesFreeShipping ??
                            order.secondOrderFreeShippingApplied
                        )
                          ? "Triggered"
                          : "Not yet"}
                      </span>
                    </td>
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
