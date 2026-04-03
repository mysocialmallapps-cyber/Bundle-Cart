import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getLatestBlogPosts } from "../content/blogPosts";
import { trackEvent } from "../lib/analytics";

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

const CONTROL_HOW_IT_WORKS_STEPS = [
  {
    step: "Step 1",
    title: "Shop from any store",
    body: "Choose what you want to buy.",
    icon: "🛍️"
  },
  {
    step: "Step 2",
    title: "Pay shipping once ($5)",
    body: "You only pay for shipping the first time.",
    icon: "💳"
  },
  {
    step: "Step 3",
    title: "Get 72hrs free shipping",
    body: "Everything else ships free for 72 hours.",
    icon: "📦"
  }
];

const TRUST_CHIPS = [
  "Built for Shopify stores",
  "72-hour bundled shopping",
  "Repeat purchase engine",
  "Cross-store order network"
];

const CONTROL_MERCHANT_BENEFITS = [
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

const CONTROL_CUSTOMER_BENEFITS = [
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

const CONTROL_VALUE_BULLETS = [
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

const CONTROL_ROI_METRICS = [
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

const CONTROL_FAQ_ITEMS = [
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

const VARIANT_CONTENT = {
  control: {
    hero: {
      eyebrow: "BUNDLECART FOR SHOPIFY",
      title: "Pay shipping once.\nEverything else ships free.",
      subtitle:
        "Buy from different stores.\nOnly pay shipping the first time.\nEverything else ships free for 72 hours."
    },
    heroNote: "First month free • Built for Shopify • No fulfilment changes",
    whyCustomersComeBack: null,
    howItWorks: {
      title: "How it works",
      steps: CONTROL_HOW_IT_WORKS_STEPS,
      support: ""
    },
    merchantSection: {
      title: "Why merchants use BundleCart",
      subtitle: "A growth layer that fits directly into existing Shopify operations.",
      cards: CONTROL_MERCHANT_BENEFITS
    },
    customerSection: {
      title: "Why customers use BundleCart",
      subtitle: "Simple value: pay shipping once, keep shopping for 72 hours.",
      cards: CONTROL_CUSTOMER_BENEFITS
    },
    networkSection: null,
    valueProps: {
      title: "Key value proposition",
      cards: CONTROL_VALUE_BULLETS
    },
    roi: {
      title: "Merchant ROI you can measure",
      subtitle: "BundleCart gives stores performance metrics tied directly to repeat-purchase behavior.",
      cards: CONTROL_ROI_METRICS
    },
    pricingSubtle:
      "BundleCart is built for stores that want more repeat purchases, stronger retention, and cross-store network growth.",
    pricingExtraLine: "",
    faqItems: CONTROL_FAQ_ITEMS
  },
  repeat_purchase_v1: {
    hero: {
      eyebrow: "BUNDLECART FOR SHOPIFY",
      title: "Turn 1 order into 2-3 orders (without more ads)",
      subtitle:
        "Once a customer pays shipping, they unlock free delivery for 72 hours - giving them a reason to come back and buy again immediately."
    },
    heroNote: "Built for Shopify stores. No fulfillment changes.",
    whyCustomersComeBack: {
      title: "Why customers actually come back",
      body: [
        "Customers don't normally reorder within 72 hours.",
        "But once they've already paid shipping, every extra order feels cheaper.",
        "So instead of waiting weeks, they buy again now."
      ],
      support:
        "BundleCart creates a reason to come back immediately - instead of later, or never."
    },
    howItWorks: {
      title: "How it works",
      steps: [
        {
          step: "Step 1",
          title: "Customer places first order",
          body: "Pays shipping as normal.",
          icon: "🛒"
        },
        {
          step: "Step 2",
          title: "Shipping unlocks a 72-hour window",
          body: "Free shipping on additional orders during the active window.",
          icon: "⏳"
        },
        {
          step: "Step 3",
          title: "Customer buys again",
          body: "From your store or across the BundleCart network.",
          icon: "🔁"
        }
      ],
      support: "Most stores see 1-2 additional orders per customer in this window."
    },
    merchantSection: {
      title: "Turn shipping into a repeat purchase engine",
      subtitle: "Turn one checkout into follow-up orders without increasing ad spend.",
      cards: [
        {
          icon: "📈",
          title: "Increase repeat purchases",
          body: "Give customers a reason to come back immediately."
        },
        {
          icon: "🔁",
          title: "Grow orders per customer",
          body: "Turn one checkout into multiple follow-up orders."
        },
        {
          icon: "🌐",
          title: "Capture network demand",
          body: "Receive orders from shoppers already inside active BundleCart windows."
        },
        {
          icon: "✅",
          title: "No fulfillment changes required",
          body: "Keep your existing Shopify checkout and ship to customers as usual."
        }
      ]
    },
    customerSection: null,
    networkSection: {
      title: "Unlock cross-store revenue",
      body: "A customer who already paid shipping on one participating store can order from other participating stores with free shipping during the same active window.",
      support:
        "This brings additional demand into your store without extra ad spend."
    },
    valueProps: null,
    roi: {
      title: "Real results from BundleCart stores",
      subtitle: "Without increasing ad spend.",
      cards: [
        {
          label: "Bundles created",
          body: "How many BundleCart windows your store starts."
        },
        {
          label: "Extra orders generated",
          body: "Additional orders beyond the first qualifying order."
        },
        {
          label: "Network orders",
          body: "Orders received from active windows started elsewhere."
        },
        {
          label: "Orders bundled",
          body: "Total orders from your store participating in BundleCart windows."
        },
        {
          label: "Average orders per bundle",
          body: "How efficiently BundleCart turns one checkout into more checkouts."
        },
        {
          label: "BundleCart fees collected",
          body: "Qualifying first-order BundleCart fees tied to bundles your store starts."
        }
      ]
    },
    pricingSubtle:
      "BundleCart is built for stores that want more repeat purchases, stronger retention, and cross-store network growth.",
    pricingExtraLine:
      "Only pay when BundleCart drives additional orders. No extra charge for linked free orders inside the same active window.",
    faqItems: [
      {
        q: "Do customers actually reorder within 72 hours?",
        a: "Yes. Once shipping is already paid, additional purchases feel cheaper and easier, which increases repeat orders inside a short window."
      },
      {
        q: "What if my customers don't usually come back quickly?",
        a: "That's exactly what BundleCart solves. It creates a reason to come back now instead of later."
      },
      {
        q: "Does BundleCart require a warehouse?",
        a: "No. Stores keep their normal Shopify fulfillment flow."
      },
      {
        q: "Do merchants have to change how they fulfill orders?",
        a: "No. BundleCart fits into existing Shopify operations."
      },
      {
        q: "Can customers order from multiple stores?",
        a: "Yes. If a customer is in an active BundleCart window, they can place eligible orders from participating stores with free shipping during that window."
      },
      {
        q: "How does merchant billing work?",
        a: "Merchants pay $50/month (first month free) plus $5 usage for qualifying first bundle orders. Linked free orders in the same active window are not billed again."
      }
    ]
  }
};

const HOME_BLOG_PREVIEW_POSTS = getLatestBlogPosts(3);

export default function MarketingPage({ variant = "control" }) {
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [shopDomainInput, setShopDomainInput] = useState("");
  const [installError, setInstallError] = useState("");
  const isRepeatPurchaseV1 = variant === "repeat_purchase_v1";
  const variantConfig = VARIANT_CONTENT[isRepeatPurchaseV1 ? "repeat_purchase_v1" : "control"];
  useEffect(() => {
    trackEvent("page_view", { path: "/", variant });
  }, [variant]);

  function openInstallModal() {
    trackEvent("cta_click", {
      buttonName: "Install BundleCart",
      buttonLabel: "Install BundleCart",
      path: "/",
      variant
    });
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

  function renderMultilineText(textValue) {
    return String(textValue || "")
      .split("\n")
      .map((line, index, lines) => (
        <span key={`${line}-${index}`}>
          {line}
          {index < lines.length - 1 ? <br /> : null}
        </span>
      ));
  }

  return (
    <div className="marketing-page">
      <header className="marketing-header">
        <div className="marketing-header-inner">
          <Link to="/" className="marketing-logo" aria-label="BundleCart home">
            <img src="/logo.png" alt="BundleCart" />
            <span>BundleCart</span>
          </Link>
          <nav className="marketing-main-nav" aria-label="Primary navigation">
            <Link to="/" className="marketing-main-nav-link marketing-main-nav-link-active">
              Home
            </Link>
            <Link to="/blog" className="marketing-main-nav-link">
              Blog
            </Link>
          </nav>
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
            <p className="marketing-eyebrow">{variantConfig.hero.eyebrow}</p>
            <h1>{renderMultilineText(variantConfig.hero.title)}</h1>
            <p className="marketing-subheadline">{renderMultilineText(variantConfig.hero.subtitle)}</p>
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
              onClick={() => {
                trackEvent("cta_click", {
                  buttonName: "See how it works",
                  buttonLabel: "See how it works",
                  path: "/",
                  variant
                });
              }}
            >
              See how it works
            </a>
          </div>
          <p className="marketing-hero-note">{variantConfig.heroNote}</p>
          <div className="marketing-hero-message-bar">BundleCart — Pay once. Ship everywhere.</div>
        </div>
        <aside className="marketing-preview-card marketing-preview-media-card" aria-label="BundleCart product preview">
          <p className="marketing-preview-title">See it in checkout</p>
          <div className="marketing-hero-container">
            <img
              src="/bundlecart-hero.png?v=2"
              className="marketing-hero-image"
              alt="BundleCart live in Shopify checkout"
            />
          </div>
          <p className="marketing-preview-foot">Customers pay once, then keep ordering with free shipping.</p>
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

      {variantConfig.whyCustomersComeBack ? (
        <section className="marketing-section marketing-section-tinted">
          <div className="marketing-section-header">
            <h2>{variantConfig.whyCustomersComeBack.title}</h2>
          </div>
          <div className="marketing-grid">
            {variantConfig.whyCustomersComeBack.body.map((line) => (
              <p key={line}>{line}</p>
            ))}
            <p className="subtle">{variantConfig.whyCustomersComeBack.support}</p>
          </div>
        </section>
      ) : null}

      <section className="marketing-trust-strip">
        {TRUST_CHIPS.map((chip) => (
          <article key={chip} className="marketing-trust-chip">
            {chip}
          </article>
        ))}
      </section>

      <section id="how-it-works" className="marketing-section">
        <h2>{variantConfig.howItWorks.title}</h2>
        <div className="marketing-how-steps">
          {variantConfig.howItWorks.steps.map((step) => (
            <article key={step.step} className="marketing-how-step">
              <p className="marketing-how-step-icon">{step.icon}</p>
              <span>{step.step}</span>
              <strong>{step.title}</strong>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
        {variantConfig.howItWorks.support ? (
          <p className="marketing-preview-foot">{variantConfig.howItWorks.support}</p>
        ) : null}
      </section>

      <section className="marketing-section">
        <div className="marketing-section-header">
          <h2>{variantConfig.merchantSection.title}</h2>
          <p>{variantConfig.merchantSection.subtitle}</p>
        </div>
        <div className="marketing-grid marketing-grid-2">
          {variantConfig.merchantSection.cards.map((benefit) => (
            <article key={benefit.title} className="marketing-benefit-card">
              <p className="marketing-benefit-icon">{benefit.icon}</p>
              <h3>{benefit.title}</h3>
              <p>{benefit.body}</p>
            </article>
          ))}
        </div>
      </section>

      {variantConfig.customerSection ? (
        <section className="marketing-section marketing-section-tinted">
          <div className="marketing-section-header">
            <h2>{variantConfig.customerSection.title}</h2>
            <p>{variantConfig.customerSection.subtitle}</p>
          </div>
          <div className="marketing-grid marketing-grid-2">
            {variantConfig.customerSection.cards.map((benefit) => (
              <article key={benefit.title} className="marketing-benefit-card">
                <p className="marketing-benefit-icon">{benefit.icon}</p>
                <h3>{benefit.title}</h3>
                <p>{benefit.body}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {variantConfig.networkSection ? (
        <section className="marketing-section marketing-section-tinted">
          <div className="marketing-section-header">
            <h2>{variantConfig.networkSection.title}</h2>
            <p>{variantConfig.networkSection.body}</p>
          </div>
          <p>{variantConfig.networkSection.support}</p>
        </section>
      ) : null}

      {variantConfig.valueProps ? (
        <section className="marketing-section">
          <h2>{variantConfig.valueProps.title}</h2>
          <div className="marketing-grid marketing-grid-4">
            {variantConfig.valueProps.cards.map((value) => (
              <article key={value.title} className="marketing-feature-card">
                <h3>{value.title}</h3>
                <p>{value.body}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="marketing-section">
        <div className="marketing-section-header">
          <h2>{variantConfig.roi.title}</h2>
          <p>{variantConfig.roi.subtitle}</p>
        </div>
        <div className="marketing-roi-panel">
          <div className="marketing-grid marketing-grid-3">
            {variantConfig.roi.cards.map((metric) => (
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
            {variantConfig.pricingSubtle}
          </p>
          {variantConfig.pricingExtraLine ? <p className="subtle">{variantConfig.pricingExtraLine}</p> : null}
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
          {variantConfig.faqItems.map((item) => (
            <details
              key={item.q}
              className="marketing-faq-item"
              onToggle={(event) => {
                if (event.currentTarget.open) {
                  trackEvent("cta_click", {
                    buttonName: "FAQ",
                    buttonLabel: item.q,
                    buttonLocation: "faq",
                    path: "/",
                    variant
                  });
                }
              }}
            >
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

      <section className="marketing-section marketing-blog-preview">
        <div className="marketing-section-header">
          <h2>Learn to Shop Smarter</h2>
          <p>Quick reads on shipping psychology, smarter checkout decisions, and better online buying habits.</p>
        </div>
        <div className="marketing-grid marketing-grid-3">
          {HOME_BLOG_PREVIEW_POSTS.map((post) => (
            <article key={post.slug} className="marketing-blog-card">
              {post.image ? (
                <img
                  className="marketing-blog-card-image"
                  src={post.image}
                  alt={post.title}
                  loading="lazy"
                />
              ) : null}
              <p className="marketing-blog-card-date">{post.dateLabel}</p>
              <h3>{post.title}</h3>
              <p>{post.excerpt}</p>
              <Link
                className="marketing-blog-card-link"
                to={`/blog/${post.slug}`}
                onClick={() => {
                  trackEvent("blog_card_click", {
                    blogTitle: post.title,
                    blogSlug: post.slug,
                    sourcePage: "/",
                    variant
                  });
                }}
              >
                Read article
              </Link>
            </article>
          ))}
        </div>
        <div className="marketing-blog-preview-actions">
          <Link to="/blog" className="marketing-btn marketing-btn-secondary">
            View all
          </Link>
        </div>
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
