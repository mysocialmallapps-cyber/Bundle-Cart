const LANDING_VARIANT_SESSION_KEY = "bundlecart_landing_variant";

export const LANDING_VARIANTS = {
  CONTROL: "control",
  REPEAT_PURCHASE_V1: "repeat_purchase_v1"
};

export const DEFAULT_LANDING_VARIANT = LANDING_VARIANTS.CONTROL;

const VALID_LANDING_VARIANTS = new Set(Object.values(LANDING_VARIANTS));

function normalizeVariant(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isBrowser() {
  return typeof window !== "undefined";
}

export function resolveLandingVariant({ urlVariant, persistInSession = true } = {}) {
  const normalizedUrlVariant = normalizeVariant(urlVariant);
  if (normalizedUrlVariant) {
    const resolvedFromUrl = VALID_LANDING_VARIANTS.has(normalizedUrlVariant)
      ? normalizedUrlVariant
      : DEFAULT_LANDING_VARIANT;
    if (persistInSession && isBrowser()) {
      try {
        window.sessionStorage.setItem(LANDING_VARIANT_SESSION_KEY, resolvedFromUrl);
      } catch {
        // Ignore storage errors by design.
      }
    }
    return resolvedFromUrl;
  }

  if (persistInSession && isBrowser()) {
    try {
      const persisted = normalizeVariant(window.sessionStorage.getItem(LANDING_VARIANT_SESSION_KEY));
      if (VALID_LANDING_VARIANTS.has(persisted)) {
        return persisted;
      }
    } catch {
      // Ignore storage errors by design.
    }
  }

  return DEFAULT_LANDING_VARIANT;
}

export function useLandingVariant() {
  if (!isBrowser()) {
    return DEFAULT_LANDING_VARIANT;
  }
  const params = new URLSearchParams(window.location.search);
  const urlVariant = params.get("variant");
  return resolveLandingVariant({ urlVariant, persistInSession: true });
}
