import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { formatAddress, formatDateTime, getCustomerName, parseMaybeJson } from "./adminUtils";

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

  const customerAddress = useMemo(
    () => parseMaybeJson(bundle?.customer_address_json),
    [bundle?.customer_address_json]
  );
  const warehouseAddress = useMemo(
    () => parseMaybeJson(bundle?.warehouse_address_json),
    [bundle?.warehouse_address_json]
  );
  const customerName = getCustomerName(customerAddress);
  const orderCount = Number(bundle?.order_count || orders.length || 0);

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
                  bundle.bundle_status === "READY_TO_SHIP" ? "status-ready" : "status-open"
                }`}
              >
                {bundle.bundle_status || "OPEN"}
              </span>
            </div>
            <div>
              <p className="detail-label">Customer Name</p>
              <strong>{customerName}</strong>
            </div>
            <div>
              <p className="detail-label">Customer Email</p>
              <strong>{bundle.email || customerAddress.email || "N/A"}</strong>
            </div>
            <div>
              <p className="detail-label">Customer Destination Address</p>
              <strong>{formatAddress(customerAddress)}</strong>
            </div>
            <div>
              <p className="detail-label">Address Hash (admin/debug only)</p>
              <strong>{bundle.address_hash || "N/A"}</strong>
            </div>
            <div>
              <p className="detail-label">Warehouse Region</p>
              <strong>{bundle.warehouse_region || "N/A"}</strong>
            </div>
            <div>
              <p className="detail-label">Warehouse Address</p>
              <strong>{formatAddress(warehouseAddress)}</strong>
            </div>
            <div>
              <p className="detail-label">Bundle Opened</p>
              <strong>{formatDateTime(bundle.bundlecart_paid_at)}</strong>
            </div>
            <div>
              <p className="detail-label">Bundle Expires</p>
              <strong>{formatDateTime(bundle.active_until)}</strong>
            </div>
            <div>
              <p className="detail-label">Orders in Bundle</p>
              <strong>{orderCount}</strong>
            </div>
          </div>

          <div className="card">
            <h4>Orders in Bundle</h4>
            {orders.length === 0 ? (
              <p className="empty-state">No linked orders available for this bundle.</p>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Shopify Order ID</th>
                      <th>Shop Domain</th>
                      <th>Order Created At</th>
                      <th>BundleCart Selected</th>
                      <th>BundleCart Paid</th>
                      <th>Order Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id || `${order.shopify_order_id}-${order.shop_domain}`}>
                        <td>{order.shopify_order_id || "N/A"}</td>
                        <td>{order.shop_domain || "N/A"}</td>
                        <td>{formatDateTime(order.order_created_at || order.created_at)}</td>
                        <td>{order.bundlecart_selected ? "Yes" : "No"}</td>
                        <td>{order.bundlecart_paid ? "Yes" : "No"}</td>
                        <td>{order.email || "N/A"}</td>
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
