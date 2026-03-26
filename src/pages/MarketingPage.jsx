import { useState } from "react";

const SHOP_DOMAIN_SUFFIX = ".myshopify.com";

function normalizeShopDomainInput(value) {
  const trimmed = String(value || "").trim().toLowerCase();
  const withoutProtocol = trimmed.replace(/^https?:\/\//, "");
  return withoutProtocol.split("/")[0];
}

function isValidShopDomain(value) {
  const normalized = normalizeShopDomainInput(value);
  return normalized.endsWith(SHOP_DOMAIN_SUFFIX) && normalized.length > SHOP_DOMAIN_SUFFIX.length;
}

const HOW_IT_WORKS_STEPS = [
  {
    icon: "🛒",
    title: "Customer chooses BundleCart at checkout",
    body: "BundleCart appears as a shipping option. The first eligible order uses a fixed $5 BundleCart fee."
  },
  {
    icon: "⏱️",
    title: "A 72-hour bundle window opens",
    body: "The first order opens a window tied to the customer address, giving shoppers time to place additional orders."
  },
  {
    icon: "📦",
    title: "Additional orders ship with free BundleCart shipping",
    body: "During the active window, customers can place more BundleCart orders across participating stores at $0 BundleCart shipping."
  }
];

const TRUST_CHIPS = [
  "Built for Shopify stores",
  "72-hour bundled shopping",
  "Repeat purchase engine",
  "Cross-store order network"
];

const MERCHANT_BENEFITS = [
  {
    icon: "📈",
    title: "Increase repeat purchases",
    body: "Give customers a reason to come back within 72 hours and complete more checkouts."
  },
  {
    icon: "🔁",
    title: "Grow orders per customer",
    body: "BundleCart turns one shipping decision into multiple follow-up orders in a single window."
  },
  {
    icon: "🌐",
    title: "Capture network demand",
    body: "Participating stores can receive network orders from shoppers already inside active BundleCart windows."
  },
  {
    icon: "✅",
    title: "No fulfillment overhaul",
    body: "Merchants keep existing Shopify checkout and ship directly to customers as usual."
  }
];

const CUSTOMER_BENEFITS = [
  {
    icon: "💸",
    title: "Pay shipping once",
    body: "Customers pay the BundleCart fee on the first eligible order in the window."
  },
  {
    icon: "🛍️",
    title: "Keep shopping for 72 hours",
    body: "Additional BundleCart orders in the active window can be added with free BundleCart shipping."
  },
  {
    icon: "🏪",
    title: "Shop across participating brands",
    body: "Customers can place BundleCart orders from multiple participating stores."
  },
  {
    icon: "📱",
    title: "Track progress easily",
    body: "A simple progress page shows orders already in the bundle and time remaining."
  }
];

const VALUE_BULLETS = [
  {
    title: "Pay shipping once",
    body: "Simple customer value that drives action."
  },
  {
    title: "Increase repeat orders",
    body: "72-hour windows create natural return behavior."
  },
  {
    title: "Turn bundles into extra revenue",
    body: "Measure incremental orders beyond the first checkout."
  },
  {
    title: "Join a growing network of stores",
    body: "BundleCart windows can generate network order flow."
  }
];

const ROI_METRICS = [
  {
    label: "Bundles created",
    body: "How many first BundleCart orders your store starts."
  },
  {
    label: "Extra orders generated",
    body: "Incremental orders beyond each first bundle order."
  },
  {
    label: "Network orders",
    body: "Orders at your store linked from windows started elsewhere."
  },
  {
    label: "Orders bundled",
    body: "Total store orders participating in BundleCart bundles."
  },
  {
    label: "Average orders per bundle",
    body: "How efficiently bundle windows convert into more checkouts."
  },
  {
    label: "BundleCart fees collected",
    body: "Qualifying first-order BundleCart fees tied to bundles your store starts."
  }
];

const FAQ_ITEMS = [
  {
    q: "Does BundleCart require a warehouse?",
    a: "No. Merchants keep shipping directly to customers using their normal fulfillment process."
  },
  {
    q: "Do merchants have to change how they fulfill orders?",
    a: "No major operational changes are required. BundleCart works as a pricing and network layer."
  },
  {
    q: "How long does the bundle window stay open?",
    a: "Each BundleCart shipping window stays active for 72 hours from the first qualifying order."
  },
  {
    q: "Can customers order from multiple stores?",
    a: "Yes. Customers can place additional BundleCart orders with participating stores during the active window."
  },
  {
    q: "How does merchant billing work?",
    a: "Merchants pay $50/month (first month free) plus $5 usage for qualifying first bundle orders. Linked free orders are not billed again."
  },
  {
    q: "What happens after the bundle window closes?",
    a: "The active window ends and customers can start a new BundleCart window on a future order."
  }
];

export default function MarketingPage() {
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [shopDomainInput, setShopDomainInput] = useState("");
  const [installError, setInstallError] = useState("");

  function openInstallModal() {
    setInstallError("");
    setIsInstallModalOpen(true);
  }

  function closeInstallModal() {
    setInstallError("");
    setIsInstallModalOpen(false);
  }

  function handleInstallSubmit(event) {
    event.preventDefault();
    const normalized = normalizeShopDomainInput(shopDomainInput);
    if (!isValidShopDomain(normalized)) {
      setInstallError("Please enter a valid Shopify domain ending in .myshopify.com");
      return;
    }
    if (typeof window !== "undefined") {
      window.location.assign(`/auth?shop=${encodeURIComponent(normalized)}`);
    }
  }

  return (
    <div className="marketing-page">
      <header className="marketing-header">
        <div className="marketing-header-inner">
          <a href="/" className="marketing-logo" aria-label="BundleCart home">
            <img src="/logo.png" alt="BundleCart" />
            <span>BundleCart</span>
          </a>
          <button
            type="button"
            className="marketing-btn marketing-btn-primary marketing-cta"
            onClick={openInstallModal}
            title="Install BundleCart"
          >
            Install BundleCart
          </button>
        </div>
      </header>

      <section className="marketing-hero">
        <div className="marketing-hero-content">
          <div>
            <p className="marketing-eyebrow">BUNDLECART FOR SHOPIFY</p>
            <h1>
              Pay shipping once.
              <br />
              Shop more stores for free.
            </h1>
            <p className="marketing-subheadline">
              Buy from multiple stores.
              <br />
              Only pay shipping one time.
              <br />
              Everything else ships free for 72 hours.
            </p>
          </div>
          <div className="marketing-cta-row">
            <button
              type="button"
              className="marketing-btn marketing-btn-primary"
              onClick={openInstallModal}
              title="Install BundleCart"
            >
              Install BundleCart
            </button>
            <a
              className="marketing-btn marketing-btn-secondary"
              href="#how-it-works"
              title="See how it works"
            >
              See how it works
            </a>
          </div>
          <p className="marketing-hero-note">First month free • Built for Shopify • No fulfilment changes</p>
          <div className="marketing-hero-message-bar">BundleCart — Pay once. Ship everywhere.</div>
        </div>
        <aside className="marketing-preview-card marketing-preview-media-card" aria-label="BundleCart product preview">
          <p className="marketing-preview-title">See BundleCart in checkout</p>
          <div className="marketing-hero-container">
            <img
              src="/bundlecart-hero.png?v=2"
              className="marketing-hero-image"
              alt="BundleCart live in Shopify checkout"
            />
          </div>
          <p className="marketing-preview-foot">
            Customers pay once, then keep ordering with free shipping for 72 hours.
          </p>
          <div className="marketing-quick-steps" aria-label="How BundleCart works">
            <article className="marketing-quick-step">
              <span>Step 1</span>
              <strong>Shop from any store</strong>
            </article>
            <article className="marketing-quick-step">
              <span>Step 2</span>
              <strong>Pay shipping once ($5)</strong>
            </article>
            <article className="marketing-quick-step">
              <span>Step 3</span>
              <strong>Get 72hrs free shipping</strong>
            </article>
          </div>
          <p className="marketing-preview-title">Why stores use BundleCart</p>
          <p className="marketing-preview-foot">More orders without more ads.</p>
          <div className="marketing-preview-grid">
            <article>
              <span>Bundles created</span>
              <strong>124</strong>
            </article>
            <article>
              <span>Extra orders generated</span>
              <strong>286</strong>
            </article>
            <article>
              <span>Network orders</span>
              <strong>78</strong>
            </article>
            <article>
              <span>Avg orders per bundle</span>
              <strong>2.7</strong>
            </article>
          </div>
          <p className="marketing-preview-foot">
            Merchants use BundleCart to convert one checkout into multiple orders in a clear 72-hour
            cycle.
          </p>
        </aside>
      </section>

      <section className="marketing-trust-strip">
        {TRUST_CHIPS.map((chip) => (
          <article key={chip} className="marketing-trust-chip">
            {chip}
          </article>
        ))}
      </section>

      <section id="how-it-works" className="marketing-section">
        <h2>How BundleCart works</h2>
        <div className="marketing-grid marketing-grid-3">
          {HOW_IT_WORKS_STEPS.map((step, index) => (
            <article key={step.title} className="marketing-step-card">
              <p className="marketing-step-index">Step {index + 1}</p>
              <p className="marketing-step-icon">{step.icon}</p>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section">
        <div className="marketing-section-header">
          <h2>Why merchants use BundleCart</h2>
          <p>A growth layer that fits directly into existing Shopify operations.</p>
        </div>
        <div className="marketing-grid marketing-grid-2">
          {MERCHANT_BENEFITS.map((benefit) => (
            <article key={benefit.title} className="marketing-benefit-card">
              <p className="marketing-benefit-icon">{benefit.icon}</p>
              <h3>{benefit.title}</h3>
              <p>{benefit.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section marketing-section-tinted">
        <div className="marketing-section-header">
          <h2>Why customers use BundleCart</h2>
          <p>Simple value: pay shipping once, keep shopping for 72 hours.</p>
        </div>
        <div className="marketing-grid marketing-grid-2">
          {CUSTOMER_BENEFITS.map((benefit) => (
            <article key={benefit.title} className="marketing-benefit-card">
              <p className="marketing-benefit-icon">{benefit.icon}</p>
              <h3>{benefit.title}</h3>
              <p>{benefit.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section">
        <h2>Key value proposition</h2>
        <div className="marketing-grid marketing-grid-4">
          {VALUE_BULLETS.map((value) => (
            <article key={value.title} className="marketing-feature-card">
              <h3>{value.title}</h3>
              <p>{value.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section">
        <div className="marketing-section-header">
          <h2>Merchant ROI you can measure</h2>
          <p>BundleCart gives stores performance metrics tied directly to repeat-purchase behavior.</p>
        </div>
        <div className="marketing-roi-panel">
          <div className="marketing-grid marketing-grid-3">
            {ROI_METRICS.map((metric) => (
              <article key={metric.label} className="marketing-roi-card">
                <h3>{metric.label}</h3>
                <p>{metric.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="marketing-section">
        <h2>Pricing</h2>
        <div className="marketing-pricing-card">
          <p className="marketing-price">$50 / month</p>
          <p className="marketing-pricing-subline">First month free</p>
          <ul className="marketing-pricing-list">
            <li>$5 per qualifying first bundle order</li>
            <li>No extra charge for linked free orders in the same window</li>
            <li>Includes merchant performance dashboard metrics</li>
          </ul>
          <p className="subtle">
            BundleCart is built for stores that want more repeat purchases, stronger retention, and
            cross-store network growth.
          </p>
          <a
            className="marketing-btn marketing-btn-primary"
            href="#"
            onClick={(event) => {
              event.preventDefault();
              openInstallModal();
            }}
            title="Install BundleCart"
          >
            Install BundleCart
          </a>
        </div>
      </section>

      <section className="marketing-section">
        <h2>Frequently asked questions</h2>
        <div className="marketing-faq-list">
          {FAQ_ITEMS.map((item) => (
            <details key={item.q} className="marketing-faq-item">
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="marketing-section marketing-final-cta">
        <h2>Start your first BundleCart month free</h2>
        <p>Install BundleCart and launch your first 72-hour shipping window in minutes.</p>
        <a
          className="marketing-btn marketing-btn-primary"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            openInstallModal();
          }}
          title="Install BundleCart"
        >
          Install BundleCart
        </a>
      </section>

      {isInstallModalOpen ? (
        <div className="marketing-modal-backdrop" role="presentation" onClick={closeInstallModal}>
          <div
            className="marketing-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bundlecart-install-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="bundlecart-install-modal-title">Install BundleCart</h3>
            <p>Enter your Shopify store domain to start the install flow.</p>
            <form onSubmit={handleInstallSubmit} className="marketing-modal-form">
              <label className="marketing-modal-label" htmlFor="bundlecart-shop-domain">
                Shopify store domain
              </label>
              <input
                id="bundlecart-shop-domain"
                className="marketing-modal-input"
                type="text"
                autoFocus
                placeholder="yourstore.myshopify.com"
                value={shopDomainInput}
                onChange={(event) => {
                  setInstallError("");
                  setShopDomainInput(event.target.value);
                }}
              />
              {installError ? <p className="marketing-modal-error">{installError}</p> : null}
              <div className="marketing-modal-actions">
                <button
                  type="button"
                  className="marketing-btn marketing-btn-secondary"
                  onClick={closeInstallModal}
                >
                  Cancel
                </button>
                <button type="submit" className="marketing-btn marketing-btn-primary">
                  Continue
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
