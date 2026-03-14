import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { formatDateTime } from "./adminUtils";

function normalizeOrder(order) {
  return {
    ...order,
    bundlecart_selected:
      order.bundlecart_selected === true ||
      order.bundlecart_selected === "true" ||
      order.bundlecart_selected === 1,
    bundlecart_paid:
      order.bundlecart_paid === true || order.bundlecart_paid === "true" || order.bundlecart_paid === 1
  };
}

export default function AdminBundleDetailPage() {
  const { id: bundleId } = useParams();
  const [bundle, setBundle] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    console.log("BUNDLE DETAIL PAGE LOAD", bundleId);
    let mounted = true;

    api
      .getAdminBundleDetail(bundleId)
      .then((payload) => {
        if (!mounted) {
          return;
        }
        setBundle(payload?.bundle || null);
        setOrders(Array.isArray(payload?.orders) ? payload.orders.map(normalizeOrder) : []);
      })
      .catch((requestError) => {
        if (!mounted) {
          return;
        }
        setError(requestError.message || "Failed to load bundle details");
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
  }, [bundleId]);

  const orderCount = Number(bundle?.order_count || orders.length || 0);
  const firstFeeOrder = useMemo(
    () => orders.find((order) => order.bundlecart_paid) || null,
    [orders]
  );
  const linkedFreeOrders = useMemo(
    () => orders.filter((order) => order.bundlecart_selected && !order.bundlecart_paid),
    [orders]
  );

  return (
    <div className="page">
      <div className="page-header">
        <h3>Bundle Detail</h3>
        <Link to="/admin/bundles" className="button button-secondary">
          Back to Bundles
        </Link>
      </div>

      {loading ? <p>Loading bundle details...</p> : null}
      {!loading && error ? <p className="inline-error">{error}</p> : null}

      {!loading && !error && bundle ? (
        <>
          <div className="card detail-grid">
            <div>
              <p className="detail-label">Bundle ID</p>
              <strong>{bundle.id}</strong>
            </div>
            <div>
              <p className="detail-label">Bundle Status</p>
              <span
                className={`status-pill ${
                  bundle.bundle_status === "EXPIRED" ? "status-expired" : "status-open"
                }`}
              >
                {bundle.bundle_status || "OPEN"}
              </span>
            </div>
            <div>
              <p className="detail-label">Bundle Started</p>
              <strong>{formatDateTime(bundle.bundlecart_paid_at)}</strong>
            </div>
            <div>
              <p className="detail-label">Bundle Expires</p>
              <strong>{formatDateTime(bundle.active_until)}</strong>
            </div>
            <div>
              <p className="detail-label">Linked Orders</p>
              <strong>{orderCount}</strong>
            </div>
            <div>
              <p className="detail-label">First Bundle Fee Order</p>
              <strong>{firstFeeOrder?.shopify_order_id || "N/A"}</strong>
            </div>
            <div>
              <p className="detail-label">Linked Free Orders</p>
              <strong>{linkedFreeOrders.length}</strong>
            </div>
          </div>

          <div className="card">
            <h4>Linked Orders</h4>
            {orders.length === 0 ? (
              <p className="empty-state">No linked orders available for this bundle.</p>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Shopify Order ID</th>
                      <th>Order Created At</th>
                      <th>First Bundle Fee</th>
                      <th>Linked Free</th>
                      <th>Shop Domain</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id || `${order.shopify_order_id}-${order.shop_domain}`}>
                        <td>{order.shopify_order_id || "N/A"}</td>
                        <td>{formatDateTime(order.order_created_at || order.created_at)}</td>
                        <td>{order.bundlecart_paid ? "Yes ($5)" : "No"}</td>
                        <td>{order.bundlecart_selected && !order.bundlecart_paid ? "Yes ($0)" : "No"}</td>
                        <td>{order.shop_domain || "N/A"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
