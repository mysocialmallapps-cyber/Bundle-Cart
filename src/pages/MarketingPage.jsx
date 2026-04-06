import { useEffect } from "react";
import { Link } from "react-router-dom";
import { getLatestBlogPosts } from "../content/blogPosts";
import { trackEvent, trackLandingEvent } from "../lib/analytics";

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
  { label: "Orders per customer", value: "2.2" }
];

const PROOF_STATS = [
  { value: "+29%", label: "Repeat purchases" },
  { value: "2.2", label: "Orders per customer" },
  { value: "+33%", label: "Revenue growth" }
];

const TRUST_LAYER_ITEMS = [
  "Built for Shopify stores",
  "No fulfillment changes",
  "Merchant dashboard included",
  "Tracks repeat orders automatically"
];

const PRICING_TIERS = [
  {
    name: "Starter",
    price: "$20/month",
    features: [
      "Up to 100 bundle orders/month",
      "Basic analytics",
      "Email support",
      "+ $5 per qualifying bundle order"
    ],
    featured: false
  },
  {
    name: "Growth",
    price: "$50/month",
    features: [
      "Up to 1000 bundle orders/month",
      "Full merchant dashboard",
      "Core features",
      "+ $5 per qualifying bundle order"
    ],
    featured: true
  },
  {
    name: "Scale",
    price: "$100/month",
    features: [
      "Unlimited orders",
      "Priority support",
      "Advanced insights",
      "+ $5 per qualifying bundle order"
    ],
    featured: false
  }
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
    heroRevenueLine: "Turn one checkout into multiple orders.",
    heroNote: "Built for Shopify stores. No fulfillment changes.",
    heroMessage: "Turn one checkout into multiple orders.",
    checkoutShowcase: {
      eyebrow: "See it in checkout",
      title: "Turn one shipping fee into repeat orders",
      body:
        "Customers pay shipping once, unlock a 72-hour window, and come back to buy again."
    },
    demo: {
      eyebrow: "See BundleCart in action",
      title: "See how BundleCart works in 30 seconds",
      body: "Watch the checkout flow, shipping unlock, repeat-order journey, and merchant dashboard."
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
      title: "Merchant dashboard",
      subtitle:
        "BundleCart gives merchants real-time visibility into linked orders, repeat purchases, and shipping-driven revenue.",
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
    heroRevenueLine: "Increase orders without increasing ad spend.",
    heroNote: "Built for Shopify stores. No fulfillment changes.",
    heroMessage: "Increase orders without increasing ad spend.",
    checkoutShowcase: {
      eyebrow: "See it in checkout",
      title: "Turn one shipping fee into repeat orders",
      body:
        "Customers pay shipping once, unlock a 72-hour window, and come back to buy again."
    },
    demo: {
      eyebrow: "See BundleCart in action",
      title: "See how BundleCart works in 30 seconds",
      body: "Watch the checkout flow, shipping unlock, repeat-order journey, and merchant dashboard."
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
      title: "Merchant dashboard",
      subtitle:
        "BundleCart gives merchants real-time visibility into linked orders, repeat purchases, and shipping-driven revenue.",
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

export default function MarketingPage({ variant = "control", onOpenInstallModal }) {
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
    trackHomepageLandingEvent("proof_section_view", { section: "proof_strip" });
    trackHomepageLandingEvent("testimonial_view", { section: "impact_feedback" });
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
    if (typeof onOpenInstallModal === "function") {
      onOpenInstallModal();
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
      <section className="marketing-hero">
        <div className="marketing-hero-content">
          <div>
            <p className="marketing-eyebrow">{variantConfig.hero.eyebrow}</p>
            <h1>{renderMultilineText(variantConfig.hero.title)}</h1>
            <p className="marketing-subheadline">{renderMultilineText(variantConfig.hero.subtitle)}</p>
          </div>
          <p className="marketing-hero-revenue-line">{variantConfig.heroRevenueLine}</p>
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
        </aside>
      </section>

      <section className="marketing-section marketing-proof-strip" aria-label="Proven results">
        <div className="marketing-section-header">
          <h2>Proven results</h2>
          <p>BundleCart is already increasing repeat purchases for Shopify stores.</p>
        </div>
        <div className="marketing-grid marketing-grid-3 marketing-proof-grid">
          {PROOF_STATS.map((stat) => (
            <article key={`${stat.value}-${stat.label}`} className="marketing-proof-card">
              <p className="marketing-proof-value">{stat.value}</p>
              <p className="marketing-proof-label">{stat.label}</p>
            </article>
          ))}
        </div>
        <p className="marketing-proof-credibility-line">
          <span>Tested on early Shopify stores</span>
        </p>
        <article className="marketing-testimonial-card marketing-proof-testimonial-card">
          <p className="marketing-testimonial-label">Merchant feedback</p>
          <blockquote>
            “We barely had repeat orders before. With BundleCart, we started getting more repeat
            purchases than new ones.”
          </blockquote>
          <p className="marketing-testimonial-role">— Shopify fashion store</p>
        </article>
      </section>

      <section className="marketing-trust-strip" aria-label="Trust highlights">
        {TRUST_LAYER_ITEMS.map((item) => (
          <article key={item} className="marketing-trust-chip">
            {item}
          </article>
        ))}
      </section>

      <section id="demo-placeholder" className="marketing-section marketing-section-tinted marketing-demo-section">
        <div className="marketing-section-header">
          <p className="marketing-eyebrow">{variantConfig.demo.eyebrow}</p>
          <h2>{variantConfig.demo.title}</h2>
          <p>{variantConfig.demo.body}</p>
        </div>
        <video
          className="marketing-demo-video"
          src="/OLD_bundlecart-demo.mp4"
          autoPlay
          muted
          loop
          controls
          playsInline
          preload="metadata"
        />
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
          <p className="marketing-eyebrow">Live merchant data</p>
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
        <h2>Simple pricing that scales with your orders</h2>
        <div className="marketing-grid marketing-grid-3 marketing-pricing-grid">
          {PRICING_TIERS.map((tier) => (
            <article
              key={tier.name}
              className={`marketing-pricing-card marketing-pricing-tier ${tier.featured ? "marketing-pricing-tier-featured" : ""}`}
            >
              {tier.featured ? <p className="marketing-pricing-badge">Most popular</p> : null}
              <h3 className="marketing-pricing-tier-name">{tier.name}</h3>
              <p className="marketing-price">{tier.price}</p>
              <ul className="marketing-pricing-list">
                {tier.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <p className="subtle marketing-pricing-logic-line">
          Only pay when BundleCart drives a qualifying first order.
        </p>
        <p className="subtle">{variantConfig.pricingSubtle}</p>
        <div className="marketing-pricing-how-it-works">
          <h3>How pricing works</h3>
          <ul className="marketing-pricing-how-it-works-list">
            <li>You only pay for the first order in a bundle</li>
            <li>Additional orders in the 72-hour window are free</li>
            <li>Repeat linked orders are not charged again</li>
            <li>Pricing is aligned with performance — you pay when BundleCart drives value</li>
          </ul>
        </div>
        <p className="subtle marketing-pricing-growth-line">
          Start small and scale as your repeat purchases grow.
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

    </div>
  );
}
