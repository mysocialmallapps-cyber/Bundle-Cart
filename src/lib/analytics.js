const TRACK_ENDPOINT = "/api/track";
const LANDING_TRACK_ENDPOINT = "/api/analytics/landing";

const ALLOWED_EVENTS = new Set([
  "page_view",
  "cta_click",
  "blog_card_click",
  "blog_post_view",
  "outbound_click",
  "landing_page_view",
  "landing_cta_click",
  "landing_secondary_cta_click",
  "landing_install_click",
  "landing_blog_card_click"
]);

const SESSION_STORAGE_KEY = "bundlecart_session_id";
const LANDING_VARIANT_SESSION_KEY = "bundlecart_landing_variant";
const VALID_LANDING_VARIANTS = new Set(["control", "repeat_purchase_v1"]);
const DEFAULT_LANDING_VARIANT = "control";

function isBrowser() {
  return typeof window !== "undefined";
}

function getCurrentPath() {
  if (!isBrowser() || !window.location) {
    return "";
  }
  return String(window.location.pathname || "").trim();
}

function getVariantFromUrl() {
  if (!isBrowser() || !window.location) {
    return "";
  }
  try {
    const params = new URLSearchParams(window.location.search || "");
    return String(params.get("variant") || "")
      .trim()
      .toLowerCase();
  } catch {
    return "";
  }
}

function getSessionLandingVariant() {
  if (!isBrowser()) {
    return "";
  }
  try {
    return String(window.sessionStorage.getItem(LANDING_VARIANT_SESSION_KEY) || "")
      .trim()
      .toLowerCase();
  } catch {
    return "";
  }
}

export function getActiveLandingVariant() {
  const fromUrl = getVariantFromUrl();
  if (VALID_LANDING_VARIANTS.has(fromUrl)) {
    return fromUrl;
  }
  const fromSession = getSessionLandingVariant();
  if (VALID_LANDING_VARIANTS.has(fromSession)) {
    return fromSession;
  }
  return DEFAULT_LANDING_VARIANT;
}

function randomId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export function getAnalyticsSessionId() {
  if (!isBrowser()) {
    return "";
  }
  try {
    const existing = String(window.sessionStorage.getItem(SESSION_STORAGE_KEY) || "").trim();
    if (existing) {
      return existing;
    }
    const created = randomId();
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, created);
    return created;
  } catch {
    return "";
  }
}

export function trackEvent(eventName, payload = {}) {
  const normalizedEvent = String(eventName || "").trim();
  if (!ALLOWED_EVENTS.has(normalizedEvent)) {
    return;
  }

  const normalizedPayload = payload && typeof payload === "object" ? { ...payload } : {};
  const payloadVariant = String(normalizedPayload.variant || "")
    .trim()
    .toLowerCase();
  if (VALID_LANDING_VARIANTS.has(payloadVariant)) {
    normalizedPayload.variant = payloadVariant;
  } else if (isBrowser()) {
    try {
      const sessionVariant = String(
        window.sessionStorage.getItem(LANDING_VARIANT_SESSION_KEY) || ""
      )
        .trim()
        .toLowerCase();
      normalizedPayload.variant = VALID_LANDING_VARIANTS.has(sessionVariant)
        ? sessionVariant
        : DEFAULT_LANDING_VARIANT;
    } catch {
      normalizedPayload.variant = DEFAULT_LANDING_VARIANT;
    }
  } else {
    normalizedPayload.variant = DEFAULT_LANDING_VARIANT;
  }

  const body = {
    event: normalizedEvent,
    payload: normalizedPayload,
    clientTimestamp: new Date().toISOString(),
    sessionId: getAnalyticsSessionId()
  };

  if (typeof console !== "undefined") {
    console.log("TRACK_EVENT_SENT", normalizedEvent, body.payload);
  }

  const jsonBody = JSON.stringify(body);

  Promise.resolve()
    .then(() => {
      if (isBrowser() && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        const blob = new Blob([jsonBody], { type: "application/json" });
        const ok = navigator.sendBeacon(TRACK_ENDPOINT, blob);
        if (ok) {
          return;
        }
      }
      return fetch(TRACK_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: jsonBody,
        keepalive: true
      });
    })
    .catch(() => {
      // Fail silently by design.
    });
}

export function trackLandingEvent(eventName, extraPayload = {}) {
  const variant = getActiveLandingVariant();
  const path = getCurrentPath();
  const sessionId = getAnalyticsSessionId();
  const normalizedExtraPayload =
    extraPayload && typeof extraPayload === "object" ? { ...extraPayload } : {};
  const payload = {
    ...normalizedExtraPayload,
    path,
    variant,
    session_id: sessionId,
    timestamp: new Date().toISOString()
  };
  if (typeof console !== "undefined") {
    console.log("Tracked landing event", { eventName, variant, session_id: sessionId, payload });
  }
  const landingBody = JSON.stringify({
    event_name: String(eventName || "").trim(),
    variant,
    path,
    session_id: sessionId,
    timestamp: payload.timestamp,
    cta_label: String(payload.cta_label || "").trim(),
    section: String(payload.section || "").trim()
  });
  Promise.resolve()
    .then(() => {
      if (isBrowser() && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        const blob = new Blob([landingBody], { type: "application/json" });
        const ok = navigator.sendBeacon(LANDING_TRACK_ENDPOINT, blob);
        if (ok) {
          return;
        }
      }
      return fetch(LANDING_TRACK_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: landingBody,
        keepalive: true
      });
    })
    .catch(() => {
      // Fail silently by design.
    });
  trackEvent(eventName, payload);
}

export function getAnalyticsReferrer() {
  if (!isBrowser() || typeof document === "undefined") {
    return "";
  }
  return String(document.referrer || "").trim();
}

export function getAnalyticsPath() {
  return getCurrentPath();
}
