const BLOG_POSTS = [
  {
    slug: "why-free-shipping-makes-you-spend-more",
    title: "Why Free Shipping Makes You Spend More",
    date: "2026-02-22",
    description:
      "Free shipping feels like a win, but it often nudges shoppers to spend more than planned.",
    preview:
      "Free shipping feels like a win, but it can push you to add extra items just to avoid a small fee.",
    image: "/bundlecart-hero.png?v=2",
    sections: [
      {
        paragraphs: [
          '"Free shipping" feels like a win.',
          "But in reality, it often makes you spend more than you planned.",
          "You go in to buy a $25 item...",
          "and leave with $55 in your cart just to avoid a small shipping fee."
        ]
      },
      {
        heading: "Why this happens",
        paragraphs: [
          "Retailers use free shipping thresholds to increase your order value.",
          '"Add $30 more to get free shipping"',
          "At that moment, your brain shifts from:",
          '"Do I need this?"',
          "to",
          '"How do I unlock free shipping?"'
        ]
      },
      {
        heading: "The real cost",
        paragraphs: [
          "Item: $25",
          "Shipping: $5",
          "Instead of paying $30 total...",
          "you add more items and spend $55.",
          "You didn't save money.",
          "You spent more."
        ]
      },
      {
        heading: "A better way",
        paragraphs: [
          "What if you paid shipping once...",
          "and unlocked free shipping across stores for a limited time?",
          "That's the idea behind BundleCart."
        ]
      },
      {
        heading: "Final thought",
        paragraphs: [
          "Free shipping isn't free.",
          "It's designed to make you spend more.",
          "Once you see it, you can shop smarter."
        ]
      }
    ]
  },
  {
    slug: "how-72-hour-windows-change-shopping",
    title: "How 72-Hour Windows Change Shopping Decisions",
    date: "2026-02-20",
    description:
      "Short shipping windows give customers a clear reason to come back and place follow-up orders quickly.",
    preview:
      "A simple timer can change checkout behavior by turning one order into multiple smart follow-ups.",
    sections: [
      {
        paragraphs: [
          "Most shoppers need a reason to return quickly.",
          "A clear 72-hour shipping window gives that reason."
        ]
      },
      {
        heading: "Why timing works",
        paragraphs: [
          "When people know time is limited, they act faster.",
          "That helps customers finish what they wanted to buy in one short window."
        ]
      }
    ]
  },
  {
    slug: "shop-smarter-without-chasing-coupons",
    title: "Shop Smarter Without Chasing Coupons",
    date: "2026-02-18",
    description:
      "Coupons can help, but better shipping strategy often saves more over multiple orders.",
    preview:
      "Instead of waiting for random coupon codes, use shipping timing to make every order count.",
    sections: [
      {
        paragraphs: [
          "Coupon hunting takes time and is not always reliable.",
          "A better strategy is to plan when and how you place orders."
        ]
      },
      {
        heading: "Simple rule",
        paragraphs: [
          "Pay shipping once, then use your free-shipping window wisely.",
          "You get predictable savings without waiting for promo luck."
        ]
      }
    ]
  }
];

export const blogPosts = BLOG_POSTS.slice().sort(
  (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
);

export function getBlogPostBySlug(slug) {
  const normalizedSlug = String(slug || "").trim().toLowerCase();
  return blogPosts.find((post) => post.slug === normalizedSlug) || null;
}

export function getLatestBlogPosts(limit = 3) {
  const safeLimit = Number(limit);
  if (!Number.isFinite(safeLimit) || safeLimit <= 0) {
    return [];
  }
  return blogPosts.slice(0, safeLimit);
}

export function formatBlogDate(value) {
  const parsed = new Date(value || "");
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}
