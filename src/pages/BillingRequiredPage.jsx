import { useState } from "react";
import { api } from "../api";

function getRuntimeShopifyApiKey() {
  const runtimeConfig =
    typeof window !== "undefined"
      ? window.__BUNDLECART_CONFIG__ || window.APP_CONFIG || {}
      : {};
  return String(runtimeConfig?.SHOPIFY_API_KEY || "").trim();
}

function parseReturnUrlFromBillingUrl(url) {
  const target = String(url || "").trim();
  if (!target) {
    return "";
  }
  try {
    const parsed = new URL(target, window.location.origin);
    return String(parsed.searchParams.get("return_url") || "").trim();
  } catch {
    return "";
  }
}

async function redirectTopWindow(url, { shop = "", host = "", embedded = false, returnUrl = "" } = {}) {
  const target = String(url || "").trim();
  if (!target) {
    return false;
  }

  const apiKey = getRuntimeShopifyApiKey();
  const normalizedHost = String(host || "").trim();
  const embeddedContext = Boolean(embedded || normalizedHost);

  // Preferred: App Bridge top-level redirect in embedded context.
  if (embeddedContext && apiKey && normalizedHost) {
    try {
      const appBridgeModule = await import("@shopify/app-bridge");
      const appBridgeActionsModule = await import("@shopify/app-bridge/actions");
      const createApp = appBridgeModule?.default || appBridgeModule?.createApp;
      const Redirect = appBridgeActionsModule?.Redirect;
      if (createApp && Redirect) {
        const app = createApp({
          apiKey,
          host: normalizedHost,
          forceRedirect: false
        });
        const redirect = Redirect.create(app);
        redirect.dispatch(Redirect.Action.REMOTE, target);
        console.log("BUNDLECART BILLING REDIRECT METHOD app_bridge_top_level", {
          shop: String(shop || "").trim().toLowerCase(),
          returnUrl: String(returnUrl || "").trim()
        });
        return true;
      }
    } catch (error) {
      console.warn("BUNDLECART BILLING APP BRIDGE REDIRECT FAILED", error);
    }
  }

  // Fallback: top-window navigation.
  try {
    if (window.top && window.top !== window) {
      window.top.location.href = target;
      console.log("BUNDLECART BILLING REDIRECT METHOD window_top_fallback", {
        shop: String(shop || "").trim().toLowerCase(),
        returnUrl: String(returnUrl || "").trim()
      });
      return true;
    }
  } catch {
    // Fall back to current window redirect below.
  }
  window.location.href = target;
  console.log("BUNDLECART BILLING REDIRECT METHOD window_self_fallback", {
    shop: String(shop || "").trim().toLowerCase(),
    returnUrl: String(returnUrl || "").trim()
  });
  return true;
}

export default function BillingRequiredPage({
  shop,
  host = "",
  embedded = false,
  approvalUrl = ""
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleActivate = async () => {
    setLoading(true);
    setError("");
    try {
      let nextUrl = "";
      let returnUrl = "";
      console.log("BUNDLECART BILLING ACTIVATION CLICK", {
        shop: String(shop || "").trim().toLowerCase()
      });
      try {
        const payload = await api.getMerchantBillingActivateUrl({
          shop,
          host,
          embedded
        });
        nextUrl = String(payload?.approval_url || "").trim();
        returnUrl = String(payload?.return_url || "").trim();
      } catch (urlError) {
        console.warn("BUNDLECART BILLING ACTIVATE URL FETCH FAILED", urlError);
      }
      if (!nextUrl) {
        nextUrl = String(approvalUrl || "").trim();
        if (!returnUrl) {
          returnUrl = parseReturnUrlFromBillingUrl(nextUrl);
        }
      }

      if (!nextUrl) {
        throw new Error("Activation URL unavailable. Please try again.");
      }
      console.log("BUNDLECART BILLING URL GENERATED", {
        shop: String(shop || "").trim().toLowerCase(),
        billingUrl: nextUrl,
        returnUrl
      });

      await redirectTopWindow(nextUrl, {
        shop,
        host,
        embedded,
        returnUrl
      });
    } catch (activationError) {
      setError(activationError.message || "Unable to start billing activation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page merchant-dashboard-page">
      <section className="card merchant-billing-required-card">
        <div className="merchant-dashboard-brand">
          <img src="/logo.png" alt="BundleCart" />
          <div>
            <h3>Activate BundleCart</h3>
            <p className="subtle">Store: {shop || "Unknown store"}</p>
          </div>
        </div>
        <p className="merchant-billing-required-message">
          BundleCart is installed, but activation is required before using the dashboard.
        </p>
        <button
          type="button"
          className="marketing-btn marketing-btn-primary merchant-billing-required-button"
          onClick={handleActivate}
          disabled={loading}
        >
          {loading ? "Opening billing approval..." : "Activate BundleCart subscription"}
        </button>
        {error ? <p className="inline-error">{error}</p> : null}
      </section>
    </div>
  );
}
