import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";

const DISCOVERY_DESCRIPTIONS = [
  "Trending streetwear and essentials",
  "High-demand beauty and wellness picks",
  "Home upgrades and everyday favorites",
  "New arrivals worth adding to your bundle",
  "Customer-loved products shipping fast",
  "Popular products from growing brands"
];

const FALLBACK_DISCOVERY_STORES = [
  {
    name: "Allbirds",
    description: "Comfort-first footwear and apparel",
    url: "https://www.allbirds.com"
  },
  {
    name: "Gymshark",
    description: "Performance apparel and activewear",
    url: "https://www.gymshark.com"
  },
  {
    name: "ColourPop",
    description: "Top-rated beauty products and kits",
    url: "https://colourpop.com"
  }
];

function formatStoreName(rawShop) {
  const shop = String(rawShop || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
  if (!shop) {
    return "Participating Store";
  }
  const base = shop.split(".")[0] || shop;
  return base
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function toShopUrl(rawShop) {
  const value = String(rawShop || "").trim();
  if (!value) {
    return "";
  }
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    return parsed.toString();
  } catch {
    return "";
  }
}

function formatRemaining(activeUntil, nowMs) {
  const expiresMs = new Date(activeUntil || "").getTime();
  const parsedExpiry = new Date(activeUntil || "");
  const expiresLabel = Number.isFinite(parsedExpiry.getTime())
    ? parsedExpiry.toLocaleString()
    : "Unknown";

  if (!Number.isFinite(expiresMs)) {
    return {
      closed: false,
      countdownLabel: "Countdown unavailable",
      expiresLabel,
      urgencyLabel: "Check back soon to continue adding orders."
    };
  }

  const remainingMs = expiresMs - nowMs;
  if (remainingMs <= 0) {
    return {
      closed: true,
      countdownLabel: "Your BundleCart window has closed.",
      expiresLabel,
      urgencyLabel: "Your bundle closes soon - do not miss free shipping."
    };
  }

  const totalMinutes = Math.floor(remainingMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const hoursAndMinutes = `${hours}h ${minutes}m`;

  return {
    closed: false,
    countdownLabel: `⏳ ${hoursAndMinutes} left to add more orders`,
    expiresLabel,
    urgencyLabel:
      hours < 12
        ? `Your bundle closes soon - only ${hoursAndMinutes} left.`
        : `You still have ${hoursAndMinutes} to add more orders for free BundleCart shipping.`
  };
}

function buildProgressMessage(orderCount, isClosed) {
  if (isClosed) {
    return `You placed ${orderCount} order${orderCount === 1 ? "" : "s"} in this bundle window.`;
  }
  if (orderCount <= 0) {
    return "Start with your first order, then keep adding more before the window closes.";
  }
  if (orderCount === 1) {
    return "You've placed 1 order - add more to maximise your BundleCart shipping.";
  }
  return `You've placed ${orderCount} orders - keep going to maximise your BundleCart shipping.`;
}

function buildDiscoveryStores(orders) {
  const normalizedOrders = Array.isArray(orders) ? orders : [];
  const stores = [];
  const seenHosts = new Set();

  for (let index = 0; index < normalizedOrders.length; index += 1) {
    const shop = normalizedOrders[index]?.shop;
    const url = toShopUrl(shop);
    if (!url) {
      continue;
    }
    const host = new URL(url).hostname.toLowerCase();
    if (seenHosts.has(host)) {
      continue;
    }
    seenHosts.add(host);
    stores.push({
      name: formatStoreName(shop),
      description: DISCOVERY_DESCRIPTIONS[stores.length % DISCOVERY_DESCRIPTIONS.length],
      url
    });
    if (stores.length >= 6) {
      break;
    }
  }

  for (let index = 0; index < FALLBACK_DISCOVERY_STORES.length && stores.length < 3; index += 1) {
    const fallbackStore = FALLBACK_DISCOVERY_STORES[index];
    const fallbackHost = new URL(fallbackStore.url).hostname.toLowerCase();
    if (seenHosts.has(fallbackHost)) {
      continue;
    }
    seenHosts.add(fallbackHost);
    stores.push({
      ...fallbackStore
    });
  }

  return stores.slice(0, 6);
}

export default function PublicBundlePage() {
  const { token } = useParams();
  const discoveryRef = useRef(null);
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
  const orderCount = bundle?.orders?.length || 0;
  const progressMessage = useMemo(
    () => buildProgressMessage(orderCount, remaining.closed),
    [orderCount, remaining.closed]
  );
  const discoveryStores = useMemo(() => buildDiscoveryStores(bundle?.orders), [bundle?.orders]);

  const handleContinueShopping = () => {
    if (discoveryRef.current) {
      discoveryRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="public-bundle-page">
      <section className="public-bundle-hero">
        <p className="marketing-eyebrow">Bundle progress</p>
        <h1>Your BundleCart window is open</h1>
        <p className="public-bundle-subtext">
          You've unlocked 72 hours of free BundleCart shipping. Keep shopping and add more orders
          before your window closes.
        </p>
        {!loading && !error && bundle ? (
          <>
            <p
              className={`public-bundle-countdown ${remaining.closed ? "public-bundle-countdown-closed" : ""}`}
            >
              {remaining.countdownLabel}
            </p>
            <div className="public-bundle-meta">
              <span>Expires: {remaining.expiresLabel}</span>
              <span>
                {orderCount} order{orderCount === 1 ? "" : "s"} in your bundle
              </span>
            </div>
            <p className="public-bundle-progress">{progressMessage}</p>
            <button type="button" className="marketing-btn marketing-btn-primary" onClick={handleContinueShopping}>
              Continue shopping
            </button>
          </>
        ) : null}
      </section>

      {loading ? <p>Loading your bundle...</p> : null}
      {!loading && error ? <p className="inline-error">{error}</p> : null}

      {!loading && !error && bundle ? (
        <>
          <section className="public-bundle-section">
            <div className="public-bundle-section-header">
              <h2>Orders in your bundle</h2>
              <span className="public-bundle-count-pill">{orderCount}</span>
            </div>
            {bundle.orders.length === 0 ? (
              <div className="public-bundle-empty-card">
                <p className="empty-state">No orders are currently linked to this bundle.</p>
              </div>
            ) : (
              <div className="public-bundle-orders-grid">
                {bundle.orders.map((order, index) => {
                  const shopUrl = toShopUrl(order.shop);
                  return (
                    <article className="public-bundle-order-card" key={`${order.order_id}-${order.shop}-${index}`}>
                      <div className="public-bundle-order-top">
                        <strong>Order #{order.order_id || "N/A"}</strong>
                        <span
                          className={`public-bundle-order-badge ${remaining.closed ? "is-closed" : "is-open"}`}
                        >
                          {remaining.closed ? "Window closed" : "In active bundle"}
                        </span>
                      </div>
                      <p className="public-bundle-order-store">{formatStoreName(order.shop)}</p>
                      <p className="public-bundle-order-domain">{order.shop || "Store unavailable"}</p>
                      {shopUrl ? (
                        <a href={shopUrl} target="_blank" rel="noreferrer" className="public-bundle-order-link">
                          Visit store
                        </a>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className={`public-bundle-urgency ${remaining.closed ? "is-closed" : ""}`}>
            <h3>Your bundle closes soon - don't miss free shipping</h3>
            <p>{remaining.urgencyLabel}</p>
          </section>

          <section className="public-bundle-section" id="bundle-discovery" ref={discoveryRef}>
            <div className="public-bundle-section-header">
              <h2>Continue shopping with BundleCart</h2>
            </div>
            <p className="public-bundle-subtle">
              Discover more stores and keep adding orders while your BundleCart window is active.
            </p>
            <div className="public-bundle-discovery-grid">
              {discoveryStores.map((store) => (
                <article className="public-bundle-discovery-card" key={`${store.url}-${store.name}`}>
                  <h3>{store.name}</h3>
                  <p>{store.description}</p>
                  <a href={store.url} target="_blank" rel="noreferrer" className="marketing-btn marketing-btn-primary">
                    Shop now
                  </a>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
