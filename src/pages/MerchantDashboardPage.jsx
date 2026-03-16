import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";

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
    tooltip: "Bundles where the first BundleCart order was placed at this store."
  },
  {
    key: "orders_bundled",
    title: "Orders Bundled",
    tooltip: "All this store's orders that are part of any BundleCart bundle."
  },
  {
    key: "extra_orders_generated",
    title: "Extra Orders Generated",
    tooltip: "Incremental orders beyond the first order in bundles for this store."
  },
  {
    key: "network_orders",
    title: "Network Orders",
    tooltip: "Orders at this store that joined bundles started by other stores."
  },
  {
    key: "avg_orders_per_bundle",
    title: "Average Orders Per Bundle",
    tooltip: "Average order count across bundles created by this store."
  },
  {
    key: "bundlecart_fees_collected",
    title: "BundleCart Fees Collected",
    tooltip: "Total customer-paid BundleCart first-order fees for bundles created here."
  }
];

export default function MerchantDashboardPage() {
  const [searchParams] = useSearchParams();
  const shop = String(searchParams.get("shop") || "")
    .trim()
    .toLowerCase();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [metrics, setMetrics] = useState({
    bundles_created: 0,
    orders_bundled: 0,
    extra_orders_generated: 0,
    network_orders: 0,
    avg_orders_per_bundle: 0,
    bundlecart_fees_collected: 0
  });

  useEffect(() => {
    let mounted = true;
    if (!shop) {
      setLoading(false);
      setError("Missing shop query parameter.");
      return () => {
        mounted = false;
      };
    }

    api
      .getMerchantDashboard(shop)
      .then((payload) => {
        if (!mounted) {
          return;
        }
        setMetrics({
          bundles_created: Number(payload?.bundles_created || 0),
          orders_bundled: Number(payload?.orders_bundled || 0),
          extra_orders_generated: Number(payload?.extra_orders_generated || 0),
          network_orders: Number(payload?.network_orders || 0),
          avg_orders_per_bundle: Number(payload?.avg_orders_per_bundle || 0),
          bundlecart_fees_collected: Number(payload?.bundlecart_fees_collected || 0)
        });
      })
      .catch((requestError) => {
        if (!mounted) {
          return;
        }
        setError(requestError.message || "Failed to load dashboard.");
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
  }, [shop]);

  const cards = useMemo(
    () =>
      KPI_DEFINITIONS.map((definition) => ({
        ...definition,
        value: formatMetricValue(definition.key, metrics[definition.key])
      })),
    [metrics]
  );

  return (
    <div className="page">
      <div className="page-header">
        <h3>Store Performance Dashboard</h3>
      </div>

      {shop ? <p className="subtle">Store: {shop}</p> : null}
      {error ? <p className="inline-error">{error}</p> : null}
      {loading ? <p>Loading dashboard metrics...</p> : null}

      {!loading && !error ? (
        <div className="stats-grid">
          {cards.map((card) => (
            <article key={card.key} className="card stat-card">
              <p title={card.tooltip}>{card.title}</p>
              <strong>{card.value}</strong>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
