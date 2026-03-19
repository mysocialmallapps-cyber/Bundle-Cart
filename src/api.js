const runtimeConfig =
  typeof window !== "undefined" ? window.__BUNDLECART_CONFIG__ || window.APP_CONFIG || {} : {};
const runtimeAppUrl = runtimeConfig.APP_URL || "";
const envAppUrl = import.meta.env.APP_URL || import.meta.env.VITE_APP_URL || "";

const APP_URL = (runtimeAppUrl || envAppUrl || "").replace(/\/$/, "");
export const API_BASE_URL = APP_URL ? `${APP_URL}/api` : "/api";

async function request(path, options = {}) {
  const { method = "GET", body, signal, headers = {} } = options;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: "include",
    signal,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const fallbackMessage = `Request failed: ${response.status}`;
    let message = fallbackMessage;
    try {
      const payload = await response.json();
      message = payload?.message || fallbackMessage;
    } catch {
      // Keep fallback message when API does not return JSON.
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function requestDashboard(path) {
  console.log("BUNDLE DASHBOARD API REQUEST", path);
  try {
    const payload = await request(path);
    console.log("BUNDLE DASHBOARD API SUCCESS", path);
    return payload;
  } catch (error) {
    console.error("BUNDLE DASHBOARD API ERROR", path, error);
    throw error;
  }
}

export const api = {
  getHealth: (signal) => request("/health", { signal }),
  getDashboard: (signal) => request("/dashboard", { signal }),
  getBundles: (signal) => request("/bundles", { signal }),
  createBundle: (payload) => request("/bundles", { method: "POST", body: payload }),
  updateBundle: (bundleId, payload) =>
    request(`/bundles/${bundleId}`, { method: "PUT", body: payload }),
  deleteBundle: (bundleId) => request(`/bundles/${bundleId}`, { method: "DELETE" }),
  getOrders: (signal) => request("/orders?crossStoreWindowHours=24", { signal }),
  getCustomerInsights: (signal) => request("/customers/insights", { signal }),
  getMerchantDashboard: (shop) =>
    request(`/merchant/dashboard?shop=${encodeURIComponent(String(shop || "").trim())}`),
  getMerchantAppAccess: (input) => {
    const shop = typeof input === "string" ? input : input?.shop;
    const host = typeof input === "object" ? String(input?.host || "").trim() : "";
    const embedded = typeof input === "object" ? Boolean(input?.embedded) : false;
    const params = new URLSearchParams();
    params.set("shop", String(shop || "").trim());
    if (host) {
      params.set("host", host);
    }
    if (embedded) {
      params.set("embedded", "1");
    }
    return request(`/merchant/app-access?${params.toString()}`);
  },
  getMerchantDashboardActivity: (shop) =>
    request(`/merchant/dashboard/activity?shop=${encodeURIComponent(String(shop || "").trim())}`),
  getMerchantBillingActivateUrl: (input) => {
    const shop = typeof input === "string" ? input : input?.shop;
    const host = typeof input === "object" ? String(input?.host || "").trim() : "";
    const embedded = typeof input === "object" ? Boolean(input?.embedded) : false;
    const params = new URLSearchParams();
    params.set("shop", String(shop || "").trim());
    if (host) {
      params.set("host", host);
    }
    if (embedded) {
      params.set("embedded", "1");
    }
    return request(`/merchant/billing/activate-url?${params.toString()}`);
  },
  getPublicBundle: (input) => {
    const token =
      typeof input === "string" ? String(input || "").trim() : String(input?.token || "").trim();
    if (token) {
      return request(`/bundle/${encodeURIComponent(token)}`);
    }

    const bundleId = String(input?.bundleId || "").trim();
    const email = String(input?.email || "")
      .trim()
      .toLowerCase();
    const params = new URLSearchParams();
    if (bundleId) {
      params.set("bundleId", bundleId);
    }
    if (email) {
      params.set("email", email);
    }
    const query = params.toString();
    return request(`/bundle${query ? `?${query}` : ""}`);
  },
  getAdminBundles: () => requestDashboard("/admin/bundles"),
  getAdminReadyBundles: () => requestDashboard("/admin/bundles/ready"),
  getAdminBundleDetail: (bundleId) => requestDashboard(`/admin/bundles/${bundleId}`)
};

export function getIntegrationConfig() {
  const redirectUrl = `${APP_URL || window.location.origin}/auth/callback`;

  return {
    appUrl: APP_URL || "(relative /api)",
    redirectUrl,
    oauthStart: `${API_BASE_URL}/shopify/auth`,
    oauthCallback: `${API_BASE_URL}/shopify/auth/callback`
  };
}
