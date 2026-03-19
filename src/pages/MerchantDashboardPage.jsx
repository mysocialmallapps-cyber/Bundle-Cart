import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import BillingRequiredPage from "./BillingRequiredPage";

function formatMetricValue(key, value) {
  const numeric = Number(value || 0);
  if (key === "avg_orders_per_bundle") {
    return numeric.toFixed(2);
  }
  if (key === "bundlecart_fees_collected") {
    return `$${numeric.toFixed(2)}`;
  }
  return `${numeric}`;
}

const KPI_DEFINITIONS = [
  {
    key: "bundles_created",
    title: "Bundles Created",
    tooltip: "Bundles where the first BundleCart order was placed at this store.",
    definition: "Number of first qualifying BundleCart orders started by this store."
  },
  {
    key: "orders_bundled",
    title: "Orders Bundled",
    tooltip: "All this store's orders that are part of any BundleCart bundle.",
    definition: "Total orders from this store that were part of a BundleCart window."
  },
  {
    key: "extra_orders_generated",
    title: "Extra Orders Generated",
    tooltip: "Incremental orders beyond the first order in bundles for this store.",
    definition: "Bundled orders beyond the first order in each bundle started by this store."
  },
  {
    key: "network_orders",
    title: "Network Orders",
    tooltip: "Orders at this store that joined bundles started by other stores.",
    definition: "Orders this store received from active BundleCart traffic started elsewhere."
  },
  {
    key: "avg_orders_per_bundle",
    title: "Average Orders Per Bundle",
    tooltip: "Average order count across bundles created by this store.",
    definition: "Total orders in bundles started by this store divided by bundles created."
  },
  {
    key: "bundlecart_fees_collected",
    title: "BundleCart Fees Collected",
    tooltip: "Total customer-paid BundleCart first-order fees for bundles created here.",
    definition: "Total qualifying BundleCart first-order fees linked to bundles started by this store."
  }
];

function formatDashboardDate(value) {
  if (!value) {
    return "—";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }
  return parsed.toLocaleString();
}

function normalizeMetricNumber(value) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

export default function MerchantDashboardPage() {
  const [searchParams] = useSearchParams();
  const shop = String(searchParams.get("shop") || "")
    .trim()
    .toLowerCase();
  const isEmbedded = String(searchParams.get("embedded") || "").trim() === "1";
  const hasHostParam = Boolean(String(searchParams.get("host") || "").trim());
  const [loading, setLoading] = useState(false);
  const [accessLoading, setAccessLoading] = useState(true);
  const [error, setError] = useState("");
  const [activityError, setActivityError] = useState("");
  const [accessState, setAccessState] = useState({
    route: "",
    approval_url: "",
    auth_url: ""
  });
  const [metrics, setMetrics] = useState({
    bundles_created: 0,
    orders_bundled: 0,
    extra_orders_generated: 0,
    network_orders: 0,
    avg_orders_per_bundle: 0,
    bundlecart_fees_collected: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    let mounted = true;
    setAccessLoading(true);
    setLoading(false);
    setError("");
    setActivityError("");
    setAccessState({
      route: "",
      approval_url: "",
      auth_url: ""
    });
    setRecentActivity([]);
    setMetrics({
      bundles_created: 0,
      orders_bundled: 0,
      extra_orders_generated: 0,
      network_orders: 0,
      avg_orders_per_bundle: 0,
      bundlecart_fees_collected: 0
    });

    if (!shop) {
      setAccessLoading(false);
      setError("Missing shop query parameter.");
      return () => {
        mounted = false;
      };
    }

    api
      .getMerchantAppAccess(shop)
      .then((payload) => {
        if (!mounted) {
          return;
        }
        setAccessState({
          route: String(payload?.route || ""),
          approval_url: String(payload?.approval_url || ""),
          auth_url: String(payload?.auth_url || "")
        });
      })
      .catch((requestError) => {
        if (!mounted) {
          return;
        }
        setError(requestError.message || "Failed to load dashboard access.");
      })
      .finally(() => {
        if (!mounted) {
          return;
        }
        setAccessLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [shop]);

  useEffect(() => {
    if (accessState.route !== "dashboard" || !shop) {
      setLoading(false);
      return undefined;
    }

    let mounted = true;
    setLoading(true);
    setError("");
    setActivityError("");

    Promise.allSettled([api.getMerchantDashboard(shop), api.getMerchantDashboardActivity(shop)])
      .then((results) => {
        if (!mounted) {
          return;
        }

        const [metricsResult, activityResult] = results;
        if (metricsResult.status === "fulfilled") {
          const payload = metricsResult.value || {};
          setMetrics({
            bundles_created: normalizeMetricNumber(payload?.bundles_created),
            orders_bundled: normalizeMetricNumber(payload?.orders_bundled),
            extra_orders_generated: normalizeMetricNumber(payload?.extra_orders_generated),
            network_orders: normalizeMetricNumber(payload?.network_orders),
            avg_orders_per_bundle: normalizeMetricNumber(payload?.avg_orders_per_bundle),
            bundlecart_fees_collected: normalizeMetricNumber(payload?.bundlecart_fees_collected)
          });
        } else {
          setError(metricsResult.reason?.message || "Failed to load dashboard.");
        }

        if (activityResult.status === "fulfilled") {
          const rows = Array.isArray(activityResult.value?.activity) ? activityResult.value.activity : [];
          setRecentActivity(rows);
        } else {
          setActivityError(activityResult.reason?.message || "Failed to load recent activity.");
        }
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
  }, [accessState.route, shop]);

  const cards = useMemo(
    () =>
      KPI_DEFINITIONS.map((definition) => ({
        ...definition,
        numericValue: normalizeMetricNumber(metrics[definition.key]),
        value: formatMetricValue(definition.key, metrics[definition.key])
      })),
    [metrics]
  );
  const hasAnyMetricData = cards.some((card) => card.numericValue > 0);
  const hasActivityData = recentActivity.length > 0;
  const showEmptyState = !loading && !error && !hasAnyMetricData && !hasActivityData;

  const insights = useMemo(() => {
    const bundlesCreated = normalizeMetricNumber(metrics.bundles_created);
    const extraOrdersGenerated = normalizeMetricNumber(metrics.extra_orders_generated);
    const avgOrdersPerBundle = normalizeMetricNumber(metrics.avg_orders_per_bundle);
    const networkOrders = normalizeMetricNumber(metrics.network_orders);
    const bundlecartFeesCollected = normalizeMetricNumber(metrics.bundlecart_fees_collected);

    const computedInsights = [];
    if (extraOrdersGenerated > 0) {
      computedInsights.push(`Your store generated ${extraOrdersGenerated} extra orders through BundleCart.`);
    } else {
      computedInsights.push(
        "BundleCart will highlight incremental orders here as customers place linked follow-up purchases."
      );
    }

    if (bundlesCreated > 0) {
      computedInsights.push(`Average bundle size is ${avgOrdersPerBundle.toFixed(2)} orders.`);
    } else {
      computedInsights.push("Average bundle size will appear after your first bundle is created.");
    }

    if (networkOrders > 0) {
      computedInsights.push(`You received ${networkOrders} network orders from BundleCart traffic.`);
    } else {
      computedInsights.push("Network order insights will appear once cross-store bundle traffic starts.");
    }

    if (bundlecartFeesCollected > 0) {
      computedInsights.push(
        `Your store has collected $${bundlecartFeesCollected.toFixed(2)} in qualifying BundleCart first-order fees.`
      );
    } else {
      computedInsights.push("BundleCart fee collection totals will populate as qualifying first orders arrive.");
    }

    return computedInsights;
  }, [metrics]);

  if (accessLoading) {
    return (
      <div className="page merchant-dashboard-page">
        <p>Loading dashboard access...</p>
      </div>
    );
  }

  if (accessState.route === "billing_required") {
    return <BillingRequiredPage shop={shop} approvalUrl={accessState.approval_url} />;
  }

  if (accessState.route === "auth_required") {
    return (
      <div className="page merchant-dashboard-page">
        <section className="card merchant-billing-required-card">
          <div className="merchant-dashboard-brand">
            <img src="/logo.png" alt="BundleCart" />
            <div>
              <h3>Reconnect BundleCart</h3>
              <p className="subtle">Store: {shop || "Unknown store"}</p>
            </div>
          </div>
          <p className="merchant-billing-required-message">
            BundleCart is not fully connected for this store yet. Reconnect to continue.
          </p>
          <a
            className="marketing-btn marketing-btn-primary merchant-billing-required-button"
            href={accessState.auth_url || `/auth?shop=${encodeURIComponent(shop)}`}
            target="_top"
            rel="noreferrer"
          >
            Reconnect BundleCart
          </a>
        </section>
      </div>
    );
  }

  return (
    <div className="page merchant-dashboard-page">
      <div className="page-header merchant-dashboard-header card compact-card">
        <div className="merchant-dashboard-brand">
          <img src="/logo.png" alt="BundleCart" />
          <div>
            <h3>BundleCart Dashboard</h3>
            <p className="subtle">Merchant performance and bundle growth</p>
          </div>
        </div>
        <div className="merchant-dashboard-context">
          <strong>{shop || "Unknown store"}</strong>
          <span className="subtle">
            {isEmbedded || hasHostParam ? "Shopify Admin embedded view" : "Direct dashboard view"}
          </span>
        </div>
      </div>

      {error ? <p className="inline-error">{error}</p> : null}
      {loading ? <p>Loading dashboard metrics...</p> : null}

      {!loading && !error ? (
        <>
          <section className="stats-grid merchant-kpi-grid">
            {cards.map((card) => (
              <article key={card.key} className="card stat-card merchant-kpi-card">
                <p title={card.tooltip}>{card.title}</p>
                <strong>{card.value}</strong>
              </article>
            ))}
          </section>

          <section className="card merchant-dashboard-section">
            <div className="card-header-inline">
              <h4>KPI definitions</h4>
            </div>
            <div className="merchant-kpi-definitions">
              {cards.map((card) => (
                <article key={`def-${card.key}`} className="merchant-definition-item">
                  <strong>{card.title}</strong>
                  <p className="subtle">{card.definition}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="card merchant-dashboard-section">
            <div className="card-header-inline">
              <h4>Store performance insights</h4>
            </div>
            <ul className="merchant-insights-list">
              {insights.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>

          <section className="card merchant-dashboard-section">
            <div className="card-header-inline">
              <h4>Recent bundle activity</h4>
            </div>
            {activityError ? <p className="inline-error">{activityError}</p> : null}
            {!activityError && !hasActivityData ? (
              <p className="subtle">
                No recent activity yet. Bundle events from this store will appear here as orders are linked.
              </p>
            ) : null}
            {!activityError && hasActivityData ? (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Bundle ID</th>
                      <th>Order ID</th>
                      <th>Store</th>
                      <th>Bundle status</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentActivity.map((row, index) => (
                      <tr key={`${row.bundle_id}-${row.order_id}-${index}`}>
                        <td>{formatDashboardDate(row.date)}</td>
                        <td>{row.bundle_id || "—"}</td>
                        <td>{row.order_id || "—"}</td>
                        <td>{row.store || shop || "—"}</td>
                        <td>
                          <span
                            className={`status-pill ${
                              row.bundle_status === "active" ? "status-open" : "status-expired"
                            }`}
                          >
                            {row.bundle_status === "active" ? "active" : "expired"}
                          </span>
                        </td>
                        <td>{row.bundle_source || "BundleCart network"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>

          {showEmptyState ? (
            <section className="card merchant-empty-state">
              <h4>Your dashboard is getting ready</h4>
              <p className="subtle">
                Once your first qualifying BundleCart orders arrive, you will see KPI trends, bundle activity, and
                network performance insights here.
              </p>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
