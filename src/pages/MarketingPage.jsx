const HOW_IT_WORKS_STEPS = [
  {
    title: "1. Customer chooses BundleCart at checkout",
    body: "Customers see BundleCart at checkout and choose it when they want flexibility to keep shopping."
  },
  {
    title: "2. A 72-hour bundle window opens",
    body: "The first eligible BundleCart order starts a 72-hour window for that customer address."
  },
  {
    title: "3. More orders ship with free BundleCart shipping",
    body: "Additional BundleCart orders in the active window can be added from participating stores with free BundleCart shipping."
  }
];

const MERCHANT_BENEFITS = [
  "Drive repeat purchases without changing fulfillment workflows",
  "Increase orders per customer with a simple pay-once shipping model",
  "Capture network traffic from customers shopping across BundleCart stores",
  "Use existing Shopify checkout and ship directly to customers"
];

const CUSTOMER_BENEFITS = [
  "Pay shipping once on the first BundleCart order",
  "Add more orders for 72 hours with free BundleCart shipping",
  "Keep shopping across participating brands",
  "Track progress in a simple BundleCart window page"
];

const VALUE_BULLETS = [
  "Pay shipping once",
  "Increase repeat orders",
  "Turn bundles into extra revenue",
  "Join a growing network of stores"
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
  return (
    <div className="marketing-page">
      <section className="marketing-hero">
        <div className="marketing-hero-content">
          <p className="marketing-eyebrow">BundleCart for Shopify</p>
          <h1>Pay shipping once. Turn one order into many.</h1>
          <p className="marketing-subheadline">
            BundleCart helps Shopify stores drive extra orders by letting customers open a 72-hour
            shipping window and add more orders with free BundleCart shipping.
          </p>
          <div className="marketing-cta-row">
            <a
              className="button button-primary"
              href="/auth?shop=your-store.myshopify.com"
              title="Install BundleCart"
            >
              Install BundleCart
            </a>
            <a className="button button-secondary" href="#how-it-works" title="See how it works">
              See how it works
            </a>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="marketing-section">
        <h2>How BundleCart works</h2>
        <div className="marketing-grid marketing-grid-3">
          {HOW_IT_WORKS_STEPS.map((step) => (
            <article key={step.title} className="card">
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section">
        <h2>Why merchants use BundleCart</h2>
        <ul className="marketing-list">
          {MERCHANT_BENEFITS.map((benefit) => (
            <li key={benefit}>{benefit}</li>
          ))}
        </ul>
      </section>

      <section className="marketing-section">
        <h2>Why customers use BundleCart</h2>
        <ul className="marketing-list">
          {CUSTOMER_BENEFITS.map((benefit) => (
            <li key={benefit}>{benefit}</li>
          ))}
        </ul>
      </section>

      <section className="marketing-section">
        <h2>Key value proposition</h2>
        <div className="marketing-grid marketing-grid-4">
          {VALUE_BULLETS.map((value) => (
            <article key={value} className="card compact-card">
              <strong>{value}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section">
        <h2>Merchant ROI you can measure</h2>
        <div className="marketing-grid marketing-grid-3">
          <article className="card">
            <h3>Bundles created</h3>
            <p>Track how many first BundleCart orders your store starts.</p>
          </article>
          <article className="card">
            <h3>Extra orders generated</h3>
            <p>Measure incremental orders created beyond the first bundle order.</p>
          </article>
          <article className="card">
            <h3>Network orders</h3>
            <p>See order volume your store receives from BundleCart network traffic.</p>
          </article>
          <article className="card">
            <h3>Orders bundled</h3>
            <p>Monitor total orders your store contributes to active bundles.</p>
          </article>
          <article className="card">
            <h3>Average orders per bundle</h3>
            <p>Understand how bundle behavior impacts repeat purchasing.</p>
          </article>
          <article className="card">
            <h3>BundleCart fees collected</h3>
            <p>Track qualifying first-order fees tied to bundles your store starts.</p>
          </article>
        </div>
      </section>

      <section className="marketing-section">
        <h2>Pricing</h2>
        <div className="card marketing-pricing-card">
          <p className="marketing-price">$50 / month</p>
          <p>First month free</p>
          <p>$5 per qualifying first bundle order</p>
          <p>No extra charge for linked free orders in the same active window</p>
          <p className="subtle">
            BundleCart is built for stores that want more repeat purchases, stronger retention, and
            cross-store network growth.
          </p>
        </div>
      </section>

      <section className="marketing-section">
        <h2>Frequently asked questions</h2>
        <div className="marketing-faq-list">
          {FAQ_ITEMS.map((item) => (
            <article key={item.q} className="card">
              <h3>{item.q}</h3>
              <p>{item.a}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section marketing-final-cta">
        <h2>Start your first BundleCart month free</h2>
        <a
          className="button button-primary"
          href="/auth?shop=your-store.myshopify.com"
          title="Install BundleCart"
        >
          Install BundleCart
        </a>
      </section>
    </div>
  );
}
