import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";

const CURATED_DISCOVERY_CATALOG = [
  {
    name: "Gymshark",
    url: "https://www.gymshark.com",
    category: "activewear",
    tagline: "Performance apparel and activewear",
    tags: ["fitness", "activewear", "performance"]
  },
  {
    name: "Lululemon",
    url: "https://shop.lululemon.com",
    category: "activewear",
    tagline: "Premium active essentials for daily movement",
    tags: ["fitness", "yoga", "premium"]
  },
  {
    name: "Alo Yoga",
    url: "https://www.aloyoga.com",
    category: "activewear",
    tagline: "Studio-to-street activewear",
    tags: ["activewear", "wellness", "street-style"]
  },
  {
    name: "SNIPES",
    url: "https://www.snipes.com",
    category: "streetwear",
    tagline: "Streetwear drops and sneaker culture staples",
    tags: ["streetwear", "sneakers", "urban"]
  },
  {
    name: "Kith",
    url: "https://kith.com",
    category: "streetwear",
    tagline: "Elevated streetwear and lifestyle collections",
    tags: ["streetwear", "premium", "lifestyle"]
  },
  {
    name: "END.",
    url: "https://www.endclothing.com",
    category: "streetwear",
    tagline: "Curated designer and streetwear edits",
    tags: ["streetwear", "luxury fashion", "sneakers"]
  },
  {
    name: "Allbirds",
    url: "https://www.allbirds.com",
    category: "footwear",
    tagline: "Comfort-first footwear and apparel",
    tags: ["footwear", "comfort", "everyday"]
  },
  {
    name: "Veja",
    url: "https://www.veja-store.com",
    category: "footwear",
    tagline: "Minimal, sustainable footwear picks",
    tags: ["footwear", "sustainable", "lifestyle"]
  },
  {
    name: "HOKA",
    url: "https://www.hoka.com",
    category: "footwear",
    tagline: "Performance running and training footwear",
    tags: ["footwear", "running", "performance"]
  },
  {
    name: "Madewell",
    url: "https://www.madewell.com",
    category: "basics",
    tagline: "Modern denim and elevated essentials",
    tags: ["basics", "denim", "lifestyle"]
  },
  {
    name: "Everlane",
    url: "https://www.everlane.com",
    category: "basics",
    tagline: "Clean wardrobe basics with premium feel",
    tags: ["basics", "minimal", "lifestyle"]
  },
  {
    name: "COS",
    url: "https://www.cos.com",
    category: "basics",
    tagline: "Refined everyday staples",
    tags: ["basics", "minimal", "fashion"]
  },
  {
    name: "Coach",
    url: "https://www.coach.com",
    category: "accessories",
    tagline: "Iconic bags and signature accessories",
    tags: ["accessories", "bags", "fashion"]
  },
  {
    name: "Kate Spade",
    url: "https://www.katespade.com",
    category: "accessories",
    tagline: "Playful accessories and statement bags",
    tags: ["accessories", "bags", "lifestyle"]
  },
  {
    name: "Mejuri",
    url: "https://mejuri.com",
    category: "accessories",
    tagline: "Fine jewelry for everyday styling",
    tags: ["accessories", "jewelry", "premium"]
  },
  {
    name: "Sephora",
    url: "https://www.sephora.com",
    category: "beauty",
    tagline: "Top beauty brands and routine essentials",
    tags: ["beauty", "skincare", "makeup"]
  },
  {
    name: "ColourPop",
    url: "https://colourpop.com",
    category: "beauty",
    tagline: "Trend-forward beauty and color drops",
    tags: ["beauty", "makeup", "trending"]
  },
  {
    name: "Glossier",
    url: "https://www.glossier.com",
    category: "beauty",
    tagline: "Skin-first beauty for everyday routines",
    tags: ["beauty", "skincare", "minimal"]
  },
  {
    name: "West Elm",
    url: "https://www.westelm.com",
    category: "home",
    tagline: "Modern home décor and essentials",
    tags: ["home", "decor", "lifestyle"]
  },
  {
    name: "Parachute",
    url: "https://www.parachutehome.com",
    category: "home",
    tagline: "Premium home comfort and bedding",
    tags: ["home", "comfort", "premium"]
  },
  {
    name: "CB2",
    url: "https://www.cb2.com",
    category: "home",
    tagline: "Contemporary furniture and home style",
    tags: ["home", "design", "modern"]
  },
  {
    name: "SSENSE",
    url: "https://www.ssense.com",
    category: "luxury fashion",
    tagline: "Luxury fashion and designer street style",
    tags: ["luxury fashion", "designer", "premium"]
  },
  {
    name: "Farfetch",
    url: "https://www.farfetch.com",
    category: "luxury fashion",
    tagline: "Global luxury boutiques in one place",
    tags: ["luxury fashion", "designer", "fashion"]
  },
  {
    name: "Mytheresa",
    url: "https://www.mytheresa.com",
    category: "luxury fashion",
    tagline: "Curated luxury ready-to-wear collections",
    tags: ["luxury fashion", "designer", "premium"]
  }
];

const CURATED_FALLBACK_BRANDS = [
  "Gymshark",
  "Allbirds",
  "Madewell",
  "ColourPop",
  "Coach",
  "West Elm"
];

const DEV_TEST_STORE_HOSTS = new Set(["2026-shopping.myshopify.com"]);

const PRIMARY_STORE_PROFILES = [
  {
    patterns: ["gymshark", "lululemon", "aloyoga", "alo-yoga", "fabletics"],
    category: "activewear",
    tags: ["fitness", "activewear", "performance"]
  },
  {
    patterns: ["snipes", "kith", "supreme", "stussy", "palace", "streetwear"],
    category: "streetwear",
    tags: ["streetwear", "urban", "sneakers"]
  },
  {
    patterns: ["allbirds", "veja", "hoka", "nike", "adidas", "newbalance"],
    category: "footwear",
    tags: ["footwear", "comfort", "performance"]
  },
  {
    patterns: ["coach", "katespade", "mejuri", "accessories", "jewelry"],
    category: "accessories",
    tags: ["accessories", "fashion", "bags"]
  },
  {
    patterns: ["sephora", "glossier", "colourpop", "ulta", "beauty", "skin", "cosmetic"],
    category: "beauty",
    tags: ["beauty", "skincare", "makeup"]
  },
  {
    patterns: ["westelm", "cb2", "parachute", "home", "decor", "furniture"],
    category: "home",
    tags: ["home", "decor", "lifestyle"]
  },
  {
    patterns: ["ssense", "farfetch", "mytheresa", "net-a-porter", "luxury", "designer"],
    category: "luxury fashion",
    tags: ["luxury fashion", "designer", "premium"]
  }
];

const DEFAULT_PROFILE = {
  category: "basics",
  tags: ["basics", "everyday", "lifestyle"]
};

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

function toHost(rawShop) {
  const url = toShopUrl(rawShop);
  if (!url) {
    return "";
  }
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function formatStoreNameFromHost(host) {
  const base = String(host || "")
    .trim()
    .toLowerCase()
    .replace(/^www\./, "")
    .split(".")[0];
  if (!base) {
    return "Participating Store";
  }
  return base
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function isDevTestStore(host) {
  const normalizedHost = String(host || "").trim().toLowerCase();
  if (!normalizedHost) {
    return false;
  }
  if (DEV_TEST_STORE_HOSTS.has(normalizedHost)) {
    return true;
  }
  if (
    normalizedHost.includes("localhost") ||
    normalizedHost.includes("ngrok") ||
    normalizedHost.includes("vercel") ||
    normalizedHost.includes("replit")
  ) {
    return true;
  }
  return /(^|[\.-])(dev|test|staging|sandbox|qa|demo)([\.-]|$)/i.test(normalizedHost);
}

function buildPrimaryStoreProfile(orders) {
  const normalizedOrders = Array.isArray(orders) ? orders : [];
  const primaryStore = normalizedOrders[0]?.shop || "";
  const primaryHost = toHost(primaryStore);
  const primaryName = formatStoreNameFromHost(primaryHost);
  const tokenSource = `${primaryHost} ${primaryName}`.toLowerCase();

  if (primaryHost) {
    const catalogMatch = CURATED_DISCOVERY_CATALOG.find((brand) =>
      brand.url.toLowerCase().includes(primaryHost.replace(/^www\./, ""))
    );
    if (catalogMatch) {
      return {
        primaryHost,
        primaryName,
        category: catalogMatch.category,
        tags: catalogMatch.tags
      };
    }
  }

  const explicitProfile = PRIMARY_STORE_PROFILES.find((profile) =>
    profile.patterns.some((pattern) => tokenSource.includes(pattern))
  );
  if (explicitProfile) {
    return {
      primaryHost,
      primaryName,
      category: explicitProfile.category,
      tags: explicitProfile.tags
    };
  }

  return {
    primaryHost,
    primaryName,
    category: DEFAULT_PROFILE.category,
    tags: DEFAULT_PROFILE.tags
  };
}

function scoreDiscoveryBrand(brand, primaryProfile) {
  const profileTags = new Set((primaryProfile?.tags || []).map((tag) => String(tag).toLowerCase()));
  const brandTags = (brand.tags || []).map((tag) => String(tag).toLowerCase());

  let score = 0;
  if (brand.category === primaryProfile.category) {
    score += 100;
  }
  let overlapCount = 0;
  for (let index = 0; index < brandTags.length; index += 1) {
    if (profileTags.has(brandTags[index])) {
      overlapCount += 1;
    }
  }
  score += overlapCount * 12;
  if (profileTags.has(String(brand.category || "").toLowerCase())) {
    score += 6;
  }
  return score;
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
  const purchasedHosts = new Set();

  for (let index = 0; index < normalizedOrders.length; index += 1) {
    const host = toHost(normalizedOrders[index]?.shop);
    if (!host) {
      continue;
    }
    purchasedHosts.add(host);
  }

  const profile = buildPrimaryStoreProfile(normalizedOrders);
  const excludedHosts = new Set([...purchasedHosts, profile.primaryHost].filter(Boolean));
  const selectedHosts = new Set();
  const recommendations = [];

  const rankedCatalog = CURATED_DISCOVERY_CATALOG.map((brand) => {
    const host = toHost(brand.url);
    return {
      ...brand,
      host,
      score: scoreDiscoveryBrand(brand, profile)
    };
  })
    .filter((brand) => {
      if (!brand.host || isDevTestStore(brand.host)) {
        return false;
      }
      return !excludedHosts.has(brand.host);
    })
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.name.localeCompare(b.name);
    });

  for (let index = 0; index < rankedCatalog.length && recommendations.length < 3; index += 1) {
    const brand = rankedCatalog[index];
    if (selectedHosts.has(brand.host)) {
      continue;
    }
    selectedHosts.add(brand.host);
    recommendations.push({
      name: brand.name,
      url: brand.url,
      category: brand.category,
      tagline: brand.tagline,
      tags: brand.tags
    });
  }

  for (let index = 0; index < CURATED_FALLBACK_BRANDS.length && recommendations.length < 3; index += 1) {
    const fallbackName = CURATED_FALLBACK_BRANDS[index];
    const fallbackBrand = CURATED_DISCOVERY_CATALOG.find((brand) => brand.name === fallbackName);
    if (!fallbackBrand) {
      continue;
    }
    const fallbackHost = toHost(fallbackBrand.url);
    if (!fallbackHost || selectedHosts.has(fallbackHost) || excludedHosts.has(fallbackHost)) {
      continue;
    }
    selectedHosts.add(fallbackHost);
    recommendations.push({
      ...fallbackBrand
    });
  }

  return recommendations.slice(0, 3);
}

export default function PublicBundlePage() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const queryBundleId = String(searchParams.get("bundleId") || "").trim();
  const queryEmail = String(searchParams.get("email") || "")
    .trim()
    .toLowerCase();
  const discoveryRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bundle, setBundle] = useState(null);
  const [bundleFound, setBundleFound] = useState(true);
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    setBundleFound(true);
    const publicToken = String(token || "").trim();

    if (!publicToken && !queryBundleId && !queryEmail) {
      setLoading(false);
      setBundleFound(false);
      setError("");
      return () => {
        mounted = false;
      };
    }

    const fetchBundle = (attempt = 0) => {
      api
        .getPublicBundle({
          token: publicToken,
          bundleId: queryBundleId,
          email: queryEmail
        })
        .then((payload) => {
          if (!mounted) {
            return;
          }

          if (!payload?.bundleFound) {
            if (attempt === 0) {
              setTimeout(() => {
                if (mounted) {
                  fetchBundle(1);
                }
              }, 1500);
              return;
            }
            setBundleFound(false);
            setError("");
            setBundle(null);
            setLoading(false);
            return;
          }

          setBundleFound(true);
          setBundle({
            bundle_id: payload?.bundle_id,
            active_until: payload?.active_until,
            orders: Array.isArray(payload?.orders) ? payload.orders : []
          });
          setLoading(false);
        })
        .catch((requestError) => {
          if (!mounted) {
            return;
          }
          if (attempt === 0) {
            setTimeout(() => {
              if (mounted) {
                fetchBundle(1);
              }
            }, 1500);
            return;
          }
          setError(requestError.message || "Unable to load bundle details.");
        })
        .finally(() => {
          if (!mounted) {
            return;
          }
          if (attempt === 1) {
            setLoading(false);
          }
        });
    };

    fetchBundle(0);

    return () => {
      mounted = false;
    };
  }, [token, queryBundleId, queryEmail]);

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
      <div className="public-bundle-brand">
        <img src="/logo.png" alt="BundleCart" />
        <span>BundleCart</span>
      </div>

      <section className="public-bundle-hero">
        <p className="marketing-eyebrow">Bundle progress</p>
        <h1>
          {bundleFound === false
            ? "No active BundleCart found for this link"
            : "Your BundleCart window is open"}
        </h1>
        <p className="public-bundle-subtext">
          {bundleFound === false
            ? "Try placing a new order to start a BundleCart shipping window."
            : "You've unlocked 72 hours of free BundleCart shipping. Keep shopping and add more orders before your window closes."}
        </p>
        {!loading && !error && bundleFound !== false && bundle ? (
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

      {!loading && !error && bundleFound === false ? (
        <section className="public-bundle-section">
          <div className="public-bundle-section-header">
            <h2>No active BundleCart found for this link</h2>
          </div>
          <p className="public-bundle-subtle">Try placing a new order to start a bundle.</p>
          <a href="/" className="marketing-btn marketing-btn-primary">
            Start a new bundle
          </a>
        </section>
      ) : null}

      {!loading && !error && bundleFound !== false && bundle ? (
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
                      <p className="public-bundle-order-store">
                        {formatStoreNameFromHost(toHost(order.shop))}
                      </p>
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
              Similar brands you may like, based on where you've already shopped.
            </p>
            <div className="public-bundle-discovery-grid">
              {discoveryStores.map((store) => (
                <article className="public-bundle-discovery-card" key={`${store.url}-${store.name}`}>
                  <h3>{store.name}</h3>
                  <p>{store.tagline}</p>
                  <span className="public-bundle-discovery-badge">{store.category}</span>
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
