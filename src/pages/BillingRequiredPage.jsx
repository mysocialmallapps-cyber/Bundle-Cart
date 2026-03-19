import { useState } from "react";
import { api } from "../api";

function redirectTopWindow(url) {
  const target = String(url || "").trim();
  if (!target) {
    return;
  }
  try {
    if (window.top && window.top !== window) {
      window.top.location.assign(target);
      return;
    }
  } catch {
    // Fall back to current window redirect below.
  }
  window.location.assign(target);
}

export default function BillingRequiredPage({ shop, approvalUrl = "" }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleActivate = async () => {
    setLoading(true);
    setError("");
    try {
      let nextUrl = String(approvalUrl || "").trim();
      if (!nextUrl) {
        const payload = await api.getMerchantBillingActivateUrl(shop);
        nextUrl = String(payload?.approval_url || "").trim();
      }

      if (!nextUrl) {
        throw new Error("Activation URL unavailable. Please try again.");
      }

      console.log("BUNDLECART ROUTE CHOSEN billing_redirect_triggered", {
        shop: String(shop || "").trim().toLowerCase()
      });
      redirectTopWindow(nextUrl);
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
