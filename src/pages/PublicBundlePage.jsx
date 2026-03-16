import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";

function formatRemaining(activeUntil, nowMs) {
  const expiresMs = new Date(activeUntil || "").getTime();
  if (!Number.isFinite(expiresMs)) {
    return { closed: false, label: "Unknown" };
  }
  const remainingMs = expiresMs - nowMs;
  if (remainingMs <= 0) {
    return { closed: true, label: "Your BundleCart window has closed." };
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return {
    closed: false,
    label: `${hours}h ${minutes}m ${seconds}s`
  };
}

export default function PublicBundlePage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bundle, setBundle] = useState(null);
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let mounted = true;
    const publicToken = String(token || "").trim();
    if (!publicToken) {
      setLoading(false);
      setError("Invalid bundle link.");
      return () => {
        mounted = false;
      };
    }

    api
      .getPublicBundle(publicToken)
      .then((payload) => {
        if (!mounted) {
          return;
        }
        setBundle({
          bundle_id: payload?.bundle_id,
          active_until: payload?.active_until,
          orders: Array.isArray(payload?.orders) ? payload.orders : []
        });
      })
      .catch((requestError) => {
        if (!mounted) {
          return;
        }
        setError(requestError.message || "Unable to load bundle details.");
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
  }, [token]);

  const remaining = useMemo(
    () => formatRemaining(bundle?.active_until, nowMs),
    [bundle?.active_until, nowMs]
  );

  return (
    <div className="page">
      <div className="page-header">
        <h3>Your BundleCart Shipping Window</h3>
      </div>

      {loading ? <p>Loading your bundle...</p> : null}
      {!loading && error ? <p className="inline-error">{error}</p> : null}

      {!loading && !error && bundle ? (
        <>
          <div className="card">
            {!remaining.closed ? (
              <>
                <p>Time remaining: {remaining.label}</p>
                <p className="subtle">
                  You can still place more orders before the window closes and they will ship
                  together.
                </p>
              </>
            ) : (
              <p>Your BundleCart window has closed.</p>
            )}
          </div>

          <div className="card">
            <h4>Orders in your bundle</h4>
            {bundle.orders.length === 0 ? (
              <p className="empty-state">No orders are currently linked to this bundle.</p>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Store</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bundle.orders.map((order, index) => (
                      <tr key={`${order.order_id}-${order.shop}-${index}`}>
                        <td>Order #{order.order_id}</td>
                        <td>{order.shop || "N/A"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!remaining.closed ? (
              <p className="subtle">Add more orders before the bundle closes.</p>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
