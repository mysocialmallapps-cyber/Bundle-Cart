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

function enabled(value) {
  return value === true || value === "true" || value === 1;
}

function formatDate(value) {
  if (!value) {
    return "N/A";
  }
  return new Date(value).toLocaleDateString();
}

export default function CustomerInsightsPage({ notify }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadCustomers = useCallback(async () => {
    try {
      setError("");
      const payload = await api.getCustomerInsights();
      setCustomers(toArray(payload));
    } catch (requestError) {
      setError(requestError.message);
      notify.error("Unable to load customer insights.");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadCustomers();
    const timer = window.setInterval(loadCustomers, 45000);
    return () => window.clearInterval(timer);
  }, [loadCustomers]);

  const summary = useMemo(() => {
    const freeShippingEligible = customers.filter((customer) =>
      enabled(customer.qualifiesFreeShipping ?? customer.secondOrderFreeShipping)
    ).length;
    const discountEligible = customers.filter((customer) =>
      enabled(customer.qualifiesBundleDiscount ?? customer.bundleDiscountEligible)
    ).length;
    return {
      total: customers.length,
      freeShippingEligible,
      discountEligible
    };
  }, [customers]);

  return (
    <div className="page">
      <div className="page-header">
        <h3>Customer Insights</h3>
        <button type="button" className="button button-secondary" onClick={loadCustomers}>
          Refresh
        </button>
      </div>

      <div className="stats-grid stats-grid-small">
        <article className="card stat-card">
          <p>Total Customers Tracked</p>
          <strong>{summary.total}</strong>
        </article>
        <article className="card stat-card">
          <p>Free Shipping Eligible</p>
          <strong>{summary.freeShippingEligible}</strong>
        </article>
        <article className="card stat-card">
          <p>Bundle Discount Eligible</p>
          <strong>{summary.discountEligible}</strong>
        </article>
      </div>

      {error ? <p className="inline-error">{error}</p> : null}
      {loading ? <p>Loading customer insights...</p> : null}

      {!loading && customers.length === 0 ? (
        <p className="empty-state">No customer insight data has been returned yet.</p>
      ) : null}

      {!loading && customers.length > 0 ? (
        <div className="card table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Email</th>
                <th>Total Orders</th>
                <th>Cross-Store Orders (24h)</th>
                <th>Free Shipping</th>
                <th>Bundle Discount</th>
                <th>Last Order</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => {
                const freeShippingEligible = enabled(
                  customer.qualifiesFreeShipping ?? customer.secondOrderFreeShipping
                );
                const discountEligible = enabled(
                  customer.qualifiesBundleDiscount ?? customer.bundleDiscountEligible
                );
                return (
                  <tr key={customer.id || customer.email}>
                    <td>{customer.name || customer.customerName || "Unknown customer"}</td>
                    <td>{customer.email || customer.customerEmail || "N/A"}</td>
                    <td>{customer.totalOrders ?? 0}</td>
                    <td>{customer.crossStoreOrders24h ?? customer.crossStoreOrders ?? 0}</td>
                    <td>
                      <span
                        className={`status-pill ${freeShippingEligible ? "status-ok" : "status-neutral"}`}
                      >
                        {freeShippingEligible ? "Eligible" : "No"}
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill ${discountEligible ? "status-ok" : "status-neutral"}`}>
                        {discountEligible ? "Eligible" : "No"}
                      </span>
                    </td>
                    <td>{formatDate(customer.lastOrderAt || customer.lastOrderDate)}</td>
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
