const TRACK_ENDPOINT = "/api/track";

const ALLOWED_EVENTS = new Set([
  "page_view",
  "cta_click",
  "blog_card_click",
  "blog_post_view",
  "outbound_click"
]);

const SESSION_STORAGE_KEY = "bundlecart_session_id";

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

  const body = {
    event: normalizedEvent,
    payload: payload && typeof payload === "object" ? payload : {},
    clientTimestamp: new Date().toISOString(),
    sessionId: getAnalyticsSessionId()
  };

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
