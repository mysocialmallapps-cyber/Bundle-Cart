const TRACK_ENDPOINT = "/api/track";

const ALLOWED_EVENTS = new Set([
  "page_view",
  "cta_click",
  "blog_card_click",
  "blog_post_view",
  "outbound_click"
]);

const SESSION_STORAGE_KEY = "bundlecart_session_id";
const LANDING_VARIANT_SESSION_KEY = "bundlecart_landing_variant";

function isBrowser() {
  return typeof window !== "undefined";
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
    const existing = String(window.localStorage.getItem(SESSION_STORAGE_KEY) || "").trim();
    if (existing) {
      return existing;
    }
    const created = randomId();
    window.localStorage.setItem(SESSION_STORAGE_KEY, created);
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
  if (!normalizedPayload.variant && isBrowser()) {
    try {
      const sessionVariant = String(
        window.sessionStorage.getItem(LANDING_VARIANT_SESSION_KEY) || ""
      )
        .trim()
        .toLowerCase();
      if (sessionVariant) {
        normalizedPayload.variant = sessionVariant;
      }
    } catch {
      // Ignore storage errors by design.
    }
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

export function getAnalyticsReferrer() {
  if (!isBrowser() || typeof document === "undefined") {
    return "";
  }
  return String(document.referrer || "").trim();
}

export function getAnalyticsPath() {
  if (!isBrowser() || typeof window === "undefined" || !window.location) {
    return "";
  }
  return String(window.location.pathname || "").trim();
}
