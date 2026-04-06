import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getLatestBlogPosts } from "../content/blogPosts";
import { trackEvent, trackLandingEvent } from "../lib/analytics";

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
    step: "Step 1",
    title: "Customer places their first order",
    body: "They pay shipping normally on the first eligible purchase.",
    icon: "🛒"
  },
  {
    step: "Step 2",
    title: "Free shipping unlocks for 72 hours",
    body: "That customer can place additional BundleCart orders without paying shipping again.",
    icon: "⏳"
  },
  {
    step: "Step 3",
    title: "More repeat orders get captured",
    body: "Stores convert one checkout into multiple follow-up purchases.",
    icon: "📈"
  }
];

const BEFORE_AFTER_CARDS = [
  {
    title: "Before BundleCart",
    points: [
      "Customers pay shipping on every order",
      "Shipping friction kills repeat purchases",
      "More drop-off at checkout"
    ]
  },
  {
    title: "With BundleCart",
    points: [
      "Customers pay shipping once",
      "72-hour free-shipping window drives return orders",
      "More orders without more ads"
    ]
  }
];

const IMPACT_METRICS = [
  { label: "Orders linked", value: "1,248" },
  { label: "Repeat orders triggered", value: "482" },
  { label: "Shipping saved", value: "$6,740" },
  { label: "Orders per customer", value: "2.6" },
  { label: "Bundle windows created", value: "317" }
];

const FAQ_ITEMS = [
  {
    q: "How does BundleCart work?",
    a: "Customers pay shipping once on the first eligible order. For the next 72 hours, additional BundleCart orders can ship free."
  },
  {
    q: "When does free shipping unlock?",
    a: "Right after the first qualifying BundleCart order. The free-shipping window stays open for 72 hours."
  },
  {
    q: "Do merchants need to change fulfillment?",
    a: "No. Stores keep their existing Shopify fulfillment flow and ship as usual."
  },
  {
    q: "Can customers order from multiple stores?",
    a: "Yes. Customers in an active BundleCart window can place eligible orders from participating stores."
  },
  {
    q: "What happens when the 72-hour window ends?",
    a: "The free-shipping window closes. A future qualifying order starts a new window."
  },
  {
    q: "How does billing work?",
    a: "BundleCart pricing remains $50/month (first month free) plus $5 for each qualifying first bundle order."
  },
  {
    q: "How is this different from free shipping thresholds?",
    a: "Thresholds push bigger single carts. BundleCart encourages customers to return and place follow-up orders."
  }
];

const VARIANT_CONTENT = {
  control: {
    hero: {
      eyebrow: "BUNDLECART FOR SHOPIFY",
      title: "Increase repeat purchases by letting customers pay shipping once",
      subtitle:
        "After the first order, customers unlock free shipping for 72 hours — giving them a reason to come back and buy again without more ads.",
      secondaryCtaLabel: "Watch demo"
    },
    heroNote: "Built for Shopify stores. No fulfillment changes.",
    heroMessage: "Revenue outcome first: remove shipping friction and capture follow-up orders.",
    checkoutShowcase: {
      eyebrow: "See BundleCart in checkout",
      title: "See how BundleCart turns one shipping fee into repeat orders",
      body:
        "Customers pay shipping once, unlock a 72-hour free-shipping window, and come back to place more orders."
    },
    demo: {
      eyebrow: "See BundleCart in action",
      title: "Watch how BundleCart turns one shipping fee into multiple orders",
      body: "Quick walkthrough of the checkout flow, shipping unlock, and merchant dashboard."
    },
    beforeAfterTitle: "Why BundleCart works",
    howItWorksTitle: "How it works",
    merchantSection: {
      title: "Merchant value / benefits",
      subtitle: "BundleCart helps stores convert one checkout into repeat purchases with less shipping friction.",
      cards: [
        {
          icon: "🔁",
          title: "Increase repeat purchases",
          body: "Create a clear reason for customers to return within 72 hours."
        },
        {
          icon: "📈",
          title: "More orders per customer",
          body: "Turn one paid shipping moment into multiple checkouts."
        },
        {
          icon: "💰",
          title: "Grow revenue without more ads",
          body: "Capture additional orders from shoppers already in buying mode."
        },
        {
          icon: "✅",
          title: "No operational overhaul",
          body: "Keep your existing Shopify checkout and fulfillment process."
        }
      ]
    },
    networkSection: {
      title: "Additional upside: network orders",
      body:
        "Participating stores can receive additional orders from customers already inside active BundleCart windows."
    },
    impactSection: {
      title: "Track the impact",
      subtitle:
        "BundleCart gives stores visibility into linked orders, repeat purchases, and shipping-driven revenue behavior.",
      cards: IMPACT_METRICS
    },
    faqItems: FAQ_ITEMS,
    pricingSubtle:
      "BundleCart is built for stores that want repeat purchases, stronger retention, and measurable shipping-driven growth.",
    pricingExtraLine:
      "Only pay when BundleCart drives qualifying first orders. Linked free orders in the same active window are not billed again.",
    finalCta: {
      title: "Turn shipping into repeat purchases",
      body:
        "Install BundleCart and give customers a reason to come back before their shipping window closes."
    }
  },
  repeat_purchase_v1: {
    hero: {
      eyebrow: "BUNDLECART FOR SHOPIFY",
      title: "Turn 1 order into 2–3 orders by removing shipping friction",
      subtitle:
        "Customers pay shipping once, unlock free shipping for 72 hours, and come back to buy again — helping stores grow repeat purchases without more ad spend.",
      secondaryCtaLabel: "Watch demo"
    },
    heroNote: "Built for Shopify stores. No fulfillment changes.",
    heroMessage: "Show customers a clear shipping unlock and capture second and third orders faster.",
    checkoutShowcase: {
      eyebrow: "See BundleCart in checkout",
      title: "See how BundleCart turns one shipping fee into repeat orders",
      body:
        "Customers pay shipping once, unlock a 72-hour free-shipping window, and come back to place more orders."
    },
    demo: {
      eyebrow: "See BundleCart in action",
      title: "Watch how BundleCart turns one shipping fee into multiple orders",
      body: "Quick walkthrough of the checkout flow, shipping unlock, and merchant dashboard."
    },
    beforeAfterTitle: "Why BundleCart works",
    howItWorksTitle: "How it works",
    merchantSection: {
      title: "Merchant value / benefits",
      subtitle: "BundleCart is a repeat-purchase engine designed to reduce shipping friction and lift conversions.",
      cards: [
        {
          icon: "🔁",
          title: "Increase repeat purchases",
          body: "Use the 72-hour window to bring customers back quickly."
        },
        {
          icon: "📈",
          title: "Grow orders per customer",
          body: "Turn one order into a sequence of follow-up purchases."
        },
        {
          icon: "💸",
          title: "Increase revenue efficiency",
          body: "Drive additional checkouts without increasing ad spend."
        },
        {
          icon: "✅",
          title: "Keep fulfillment unchanged",
          body: "BundleCart works with your existing Shopify operations."
        }
      ]
    },
    networkSection: {
      title: "Additional upside: network orders",
      body:
        "Participating stores can receive additional orders from customers already inside active BundleCart windows."
    },
    impactSection: {
      title: "Track the impact",
      subtitle:
        "BundleCart gives stores visibility into linked orders, repeat purchases, and shipping-driven revenue behavior.",
      cards: IMPACT_METRICS
    },
    faqItems: FAQ_ITEMS,
    pricingSubtle:
      "BundleCart is built for stores focused on repeat purchases, retention, and incremental revenue from returning shoppers.",
    pricingExtraLine:
      "Only pay when BundleCart drives qualifying first orders. Linked free orders in the same active window are not billed again.",
    finalCta: {
      title: "Turn shipping into repeat purchases",
      body:
        "Install BundleCart and give customers a reason to come back before their shipping window closes."
    }
  }
};

const HOME_BLOG_PREVIEW_POSTS = getLatestBlogPosts(3);

export default function MarketingPage({ variant = "control" }) {
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [shopDomainInput, setShopDomainInput] = useState("");
  const [installError, setInstallError] = useState("");
  const isRepeatPurchaseV1 = variant === "repeat_purchase_v1";
  const variantConfig = VARIANT_CONTENT[isRepeatPurchaseV1 ? "repeat_purchase_v1" : "control"];
  function trackHomepageLandingEvent(eventName, extraPayload) {
    if (typeof window !== "undefined" && window.location.pathname !== "/") {
      return;
    }
    trackLandingEvent(eventName, extraPayload);
  }

  useEffect(() => {
    trackEvent("page_view", { path: "/", variant });
    trackHomepageLandingEvent("landing_page_view");
  }, [variant]);

  function openInstallModal() {
    trackEvent("cta_click", {
      buttonName: "Install BundleCart",
      buttonLabel: "Install BundleCart",
      path: "/",
      variant
    });
    trackHomepageLandingEvent("landing_install_click", {
      cta_label: "Install BundleCart",
      section: "hero"
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
              href="#demo-placeholder"
              title={variantConfig.hero.secondaryCtaLabel}
              onClick={() => {
                trackEvent("cta_click", {
                  buttonName: variantConfig.hero.secondaryCtaLabel,
                  buttonLabel: variantConfig.hero.secondaryCtaLabel,
                  path: "/",
                  variant
                });
                trackHomepageLandingEvent("landing_secondary_cta_click", {
                  cta_label: variantConfig.hero.secondaryCtaLabel,
                  section: "hero"
                });
              }}
            >
              {variantConfig.hero.secondaryCtaLabel}
            </a>
          </div>
          <p className="marketing-hero-note">{variantConfig.heroNote}</p>
          <div className="marketing-hero-message-bar">{variantConfig.heroMessage}</div>
        </div>
      </section>

      <section className="marketing-section marketing-checkout-showcase">
        <div className="marketing-section-header">
          <p className="marketing-eyebrow">{variantConfig.checkoutShowcase.eyebrow}</p>
          <h2>{variantConfig.checkoutShowcase.title}</h2>
          <p>{variantConfig.checkoutShowcase.body}</p>
        </div>
        <aside className="marketing-preview-card marketing-preview-media-card" aria-label="BundleCart product preview">
          <div className="marketing-hero-container">
            <img
              src="/bundlecart-hero.png?v=2"
              className="marketing-hero-image"
              alt="BundleCart live in Shopify checkout"
            />
          </div>
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
            Merchants can show customers one shipping payment, then capture additional orders in the next
            72 hours.
          </p>
        </aside>
      </section>

      <section id="demo-placeholder" className="marketing-section marketing-section-tinted marketing-demo-section">
        <div className="marketing-section-header">
          <p className="marketing-eyebrow">{variantConfig.demo.eyebrow}</p>
          <h2>{variantConfig.demo.title}</h2>
          <p>{variantConfig.demo.body}</p>
        </div>
        <button
          type="button"
          className="marketing-demo-placeholder"
          onClick={() =>
            trackHomepageLandingEvent("landing_cta_click", {
              cta_label: "Demo placeholder",
              section: "demo_placeholder"
            })
          }
          title="Demo placeholder"
        >
          <span className="marketing-demo-play">▶</span>
          <span>Demo placeholder — add local video asset later</span>
        </button>
      </section>

      <section className="marketing-section">
        <h2>{variantConfig.beforeAfterTitle}</h2>
        <div className="marketing-grid marketing-grid-2">
          {BEFORE_AFTER_CARDS.map((card) => (
            <article key={card.title} className="marketing-feature-card marketing-before-after-card">
              <h3>{card.title}</h3>
              <ul className="marketing-bullet-list">
                {card.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="marketing-section">
        <h2>{variantConfig.howItWorksTitle}</h2>
        <div className="marketing-how-steps">
          {HOW_IT_WORKS_STEPS.map((step) => (
            <article key={step.step} className="marketing-how-step">
              <p className="marketing-how-step-icon">{step.icon}</p>
              <span>{step.step}</span>
              <strong>{step.title}</strong>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
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

      {variantConfig.networkSection ? (
        <section className="marketing-section marketing-section-tinted">
          <div className="marketing-section-header">
            <h2>{variantConfig.networkSection.title}</h2>
            <p>{variantConfig.networkSection.body}</p>
          </div>
        </section>
      ) : null}

      <section className="marketing-section">
        <div className="marketing-section-header">
          <h2>{variantConfig.impactSection.title}</h2>
          <p>{variantConfig.impactSection.subtitle}</p>
        </div>
        <div className="marketing-roi-panel">
          <div className="marketing-grid marketing-grid-5">
            {variantConfig.impactSection.cards.map((metric) => (
              <article key={metric.label} className="marketing-roi-card">
                <h3>{metric.label}</h3>
                <p className="marketing-roi-value">{metric.value}</p>
              </article>
            ))}
          </div>
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
          <p className="subtle">{variantConfig.pricingSubtle}</p>
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

      <section className="marketing-section marketing-final-cta">
        <h2>{variantConfig.finalCta.title}</h2>
        <p>{variantConfig.finalCta.body}</p>
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
                  trackHomepageLandingEvent("landing_blog_card_click", {
                    cta_label: "Read article",
                    section: "home_blog_preview",
                    blogTitle: post.title,
                    blogSlug: post.slug
                  });
                }}
              >
                Read article
              </Link>
            </article>
          ))}
        </div>
        <div className="marketing-blog-preview-actions">
          <Link
            to="/blog"
            className="marketing-btn marketing-btn-secondary"
            onClick={() => {
              trackHomepageLandingEvent("landing_cta_click", {
                cta_label: "View all",
                section: "home_blog_preview"
              });
            }}
          >
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
