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

function boolValue(value) {
  return value === true || value === "true" || value === 1;
}

function formatDate(value) {
  if (!value) {
    return "N/A";
  }
  return new Date(value).toLocaleString();
}

function formatMoney(total, currency = "USD") {
  const amount = Number(total);
  if (!Number.isFinite(amount)) {
    return total ?? "N/A";
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

export default function OrdersPage({ notify }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOrders = useCallback(async () => {
    try {
      setError("");
      const payload = await api.getOrders();
      setOrders(toArray(payload));
    } catch (requestError) {
      setError(requestError.message);
      notify.error("Unable to load orders.");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadOrders();
    const timer = window.setInterval(loadOrders, 30000);
    return () => window.clearInterval(timer);
  }, [loadOrders]);

  const crossStoreCount = useMemo(
    () => orders.filter((order) => boolValue(order.crossStoreWithin24h ?? order.crossStoreEligible)).length,
    [orders]
  );

  return (
    <div className="page">
      <div className="page-header">
        <h3>Orders</h3>
        <button type="button" className="button button-secondary" onClick={loadOrders}>
          Refresh
        </button>
      </div>
      <p className="subtle">
        Showing all customer orders, including cross-store order behavior over the last 24 hours.
      </p>
      <div className="card compact-card">
        <strong>{crossStoreCount}</strong> cross-store orders flagged in the past 24h window.
      </div>

      {error ? <p className="inline-error">{error}</p> : null}
      {loading ? <p>Loading orders...</p> : null}

      {!loading && orders.length === 0 ? (
        <p className="empty-state">No orders available from the backend yet.</p>
      ) : null}

      {!loading && orders.length > 0 ? (
        <div className="card table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Store</th>
                <th>Total</th>
                <th>Bundle</th>
                <th>Cross-Store (24h)</th>
                <th>Free Shipping Trigger</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const crossStore = boolValue(order.crossStoreWithin24h ?? order.crossStoreEligible);
                const freeShipping = boolValue(
                  order.freeShippingTriggered ??
                    order.qualifiesFreeShipping ??
                    order.secondOrderFreeShippingApplied
                );
                return (
                  <tr key={order.id}>
                    <td>{order.orderNumber || order.id}</td>
                    <td>{order.customerName || order.customerEmail || "Unknown"}</td>
                    <td>{order.storeName || order.store || "N/A"}</td>
                    <td>{formatMoney(order.totalAmount ?? order.total, order.currency)}</td>
                    <td>{order.bundleTitle || order.bundleName || "None"}</td>
                    <td>
                      <span className={`status-pill ${crossStore ? "status-ok" : "status-neutral"}`}>
                        {crossStore ? "Yes" : "No"}
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill ${freeShipping ? "status-ok" : "status-neutral"}`}>
                        {freeShipping ? "Triggered" : "Pending"}
                      </span>
                    </td>
                    <td>{formatDate(order.createdAt || order.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
