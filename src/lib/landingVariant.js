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

function normalizePathname(value) {
  const normalized = String(value || "").trim();
  return normalized || "/";
}

function isHomepagePath(pathname) {
  return normalizePathname(pathname) === "/";
}

function readPersistedVariant() {
  if (!isBrowser()) {
    return "";
  }
  try {
    return normalizeVariant(window.sessionStorage.getItem(LANDING_VARIANT_SESSION_KEY));
  } catch {
    return "";
  }
}

function persistVariant(variant) {
  if (!isBrowser()) {
    return;
  }
  try {
    window.sessionStorage.setItem(LANDING_VARIANT_SESSION_KEY, variant);
  } catch {
    // Ignore storage errors by design.
  }
}

function pickRandomVariant() {
  return Math.random() < 0.5 ? LANDING_VARIANTS.CONTROL : LANDING_VARIANTS.REPEAT_PURCHASE_V1;
}

export function resolveLandingVariant({ urlVariant, persistInSession = true, pathname } = {}) {
  const currentPathname = normalizePathname(pathname || (isBrowser() ? window.location.pathname : "/"));
  const homepage = isHomepagePath(currentPathname);
  const normalizedUrlVariant = normalizeVariant(urlVariant);
  if (normalizedUrlVariant) {
    const resolvedFromUrl = VALID_LANDING_VARIANTS.has(normalizedUrlVariant)
      ? normalizedUrlVariant
      : DEFAULT_LANDING_VARIANT;
    if (persistInSession && homepage) {
      persistVariant(resolvedFromUrl);
    }
    return resolvedFromUrl;
  }

  if (persistInSession && homepage) {
    const persisted = readPersistedVariant();
    if (VALID_LANDING_VARIANTS.has(persisted)) {
      return persisted;
    }
    const assigned = pickRandomVariant();
    persistVariant(assigned);
    return assigned;
  }

  return DEFAULT_LANDING_VARIANT;
}

export function useLandingVariant() {
  if (!isBrowser()) {
    return DEFAULT_LANDING_VARIANT;
  }
  const params = new URLSearchParams(window.location.search);
  const urlVariant = params.get("variant");
  return resolveLandingVariant({
    urlVariant,
    persistInSession: true,
    pathname: window.location.pathname
  });
}
