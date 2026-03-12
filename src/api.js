const runtimeAppUrl =
  typeof window !== "undefined" ? window.__BUNDLECART_CONFIG__?.APP_URL : "";
const envAppUrl = import.meta.env.APP_URL || import.meta.env.VITE_APP_URL || "";
const runtimeAdminToken =
  typeof window !== "undefined" ? window.__BUNDLECART_CONFIG__?.ADMIN_DASHBOARD_TOKEN : "";
const envAdminToken =
  import.meta.env.ADMIN_DASHBOARD_TOKEN || import.meta.env.VITE_ADMIN_DASHBOARD_TOKEN || "";

const APP_URL = (runtimeAppUrl || envAppUrl || "").replace(/\/$/, "");
export const API_BASE_URL = APP_URL ? `${APP_URL}/api` : "/api";
const ADMIN_DASHBOARD_TOKEN = runtimeAdminToken || envAdminToken || "";

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

function getAdminHeaders() {
  return ADMIN_DASHBOARD_TOKEN ? { "X-ADMIN-TOKEN": ADMIN_DASHBOARD_TOKEN } : {};
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
  getAdminBundles: () =>
    request("/admin/bundles", {
      headers: getAdminHeaders()
    }),
  getAdminReadyBundles: () =>
    request("/admin/bundles/ready", {
      headers: getAdminHeaders()
    }),
  getAdminBundleDetail: (bundleId) =>
    request(`/admin/bundles/${bundleId}`, {
      headers: getAdminHeaders()
    })
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
