import { Resend } from "resend";

const EMAIL_PROVIDER = String(
  process.env.EMAIL_PROVIDER || process.env.BUNDLECART_EMAIL_PROVIDER || ""
)
  .trim()
  .toLowerCase();
const RESEND_API_KEY = String(
  process.env.RESEND_API_KEY || process.env.BUNDLECART_EMAIL_API_KEY || ""
).trim();
const EMAIL_FROM = "BundleCart <noreply@mail.bundlecart.app>";

let resendClient = null;
let providerConfiguredLogged = false;
const BUNDLECART_BRAND_PURPLE = "#6d28d9";
const BUNDLECART_BRAND_INDIGO = "#4f46e5";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatExpiryDateTime(activeUntil) {
  if (!activeUntil) {
    return "N/A";
  }
  const parsed = new Date(activeUntil);
  if (Number.isNaN(parsed.getTime())) {
    return "N/A";
  }
  return parsed.toUTCString();
}

function formatTimeLeft(activeUntil) {
  if (!activeUntil) {
    return "N/A";
  }
  const expiryMs = new Date(activeUntil).getTime();
  if (!Number.isFinite(expiryMs)) {
    return "N/A";
  }
  const deltaMs = expiryMs - Date.now();
  if (deltaMs <= 0) {
    return "0h 0m";
  }
  const totalMinutes = Math.floor(deltaMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!Number.isFinite(minutes)) {
    return `${hours} hours`;
  }
  return `${hours}h ${minutes}m`;
}

function buildEmailLayout({
  headline,
  subtext,
  activeUntil,
  orderCount,
  ctaText,
  ctaUrl,
  urgencyText,
  secondaryCopy
}) {
  const fallbackCtaUrl = String(process.env.APP_URL || "https://bundle-cart.replit.app").trim();
  const resolvedCtaUrl = String(ctaUrl || fallbackCtaUrl).trim();
  const safeHeadline = escapeHtml(headline);
  const safeSubtext = escapeHtml(subtext);
  const safeOrderCount = String(Number.isFinite(orderCount) ? orderCount : 0);
  const safeExpiry = escapeHtml(formatExpiryDateTime(activeUntil));
  const safeTimeLeft = escapeHtml(formatTimeLeft(activeUntil));
  const safeCtaText = escapeHtml(ctaText);
  const safeCtaUrl = escapeHtml(resolvedCtaUrl);
  const safeUrgencyText = escapeHtml(urgencyText || "Your bundle closes soon - do not miss free shipping.");
  const safeSecondaryCopy = escapeHtml(secondaryCopy || "");

  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:#F5F3FF;margin:0;padding:24px 0;">
  <tr>
    <td align="center" style="padding:0 12px;">
      <table role="presentation" width="620" cellspacing="0" cellpadding="0" border="0" style="width:620px;max-width:620px;background-color:#ffffff;border:1px solid #E9DDFC;border-radius:16px;overflow:hidden;box-shadow:0 12px 28px rgba(76,29,149,0.14);">
        <tr>
          <td align="center" style="padding:24px 28px 18px 28px;font-family:Arial,sans-serif;">
            <div style="text-align:center;margin-bottom:20px;">
              <img src="https://bundlecart.app/logo.png" alt="BundleCart" width="120" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;" />
              <h2 style="margin:10px 0 0;color:#5b21b6;font-size:28px;line-height:34px;font-weight:700;font-family:Arial,sans-serif;">BundleCart</h2>
              <p style="margin:4px 0 0;color:#6b7280;font-size:14px;line-height:20px;font-family:Arial,sans-serif;">Pay shipping once. Add more orders.</p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:0 28px;">
            <div style="height:1px;background:#EDE9FE;"></div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 28px 0 28px;font-family:Arial,sans-serif;">
            <div style="font-size:29px;line-height:36px;font-weight:700;color:#1E1B4B;">${safeHeadline}</div>
            <div style="margin-top:10px;font-size:16px;line-height:24px;color:#433B68;">
              ${safeSubtext}
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 28px 0 28px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#FAF7FF;border:1px solid #E6DCFC;border-radius:14px;">
              <tr>
                <td style="padding:16px 18px;font-family:Arial,sans-serif;">
                  <div style="font-size:13px;color:#625b87;line-height:18px;font-weight:600;">Bundle progress</div>
                  <div style="margin-top:6px;font-size:27px;line-height:34px;font-weight:800;color:${BUNDLECART_BRAND_PURPLE};">⏳ ${safeTimeLeft} left to add more orders</div>
                  <div style="margin-top:10px;font-size:14px;line-height:20px;color:#2E2A52;"><strong>Expires:</strong> ${safeExpiry}</div>
                  <div style="margin-top:6px;font-size:14px;line-height:20px;color:#2E2A52;"><strong>Orders in bundle:</strong> ${safeOrderCount}</div>
                  <div style="margin-top:10px;font-size:14px;line-height:20px;color:#433B68;">You've unlocked 72 hours of free BundleCart shipping. Keep shopping and add more orders before your window closes.</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 28px 0 28px;">
            <a href="${safeCtaUrl}" style="display:block;width:100%;background:linear-gradient(135deg, ${BUNDLECART_BRAND_PURPLE} 0%, ${BUNDLECART_BRAND_INDIGO} 100%);color:#ffffff;text-decoration:none;text-align:center;font-family:Arial,sans-serif;font-size:17px;line-height:22px;font-weight:700;padding:15px 18px;border-radius:12px;box-sizing:border-box;">
              ${safeCtaText}
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 28px 0 28px;font-family:Arial,sans-serif;font-size:13px;line-height:20px;color:#5D578C;text-align:center;">
            If the button doesn't work, open this link:<br />
            <a href="${safeCtaUrl}" style="color:${BUNDLECART_BRAND_PURPLE};word-break:break-all;">${safeCtaUrl}</a>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 28px 0 28px;font-family:Arial,sans-serif;font-size:15px;line-height:22px;color:#3E3968;">
            ${safeSecondaryCopy}
          </td>
        </tr>
        <tr>
          <td style="padding:14px 28px 0 28px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#F3E8FF;border:1px solid #DDD6FE;border-radius:12px;">
              <tr>
                <td style="padding:14px 15px;font-family:Arial,sans-serif;">
                  <div style="font-size:16px;line-height:22px;color:#4C1D95;font-weight:800;">⏳ ${safeTimeLeft} left to add more orders</div>
                  <div style="margin-top:6px;font-size:14px;line-height:20px;color:#5B21B6;font-weight:700;">
                    ${safeUrgencyText}
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:22px 28px 26px 28px;font-family:Arial,sans-serif;font-size:12px;line-height:19px;color:#706A99;">
            BundleCart helps shoppers pay shipping once, then keep adding orders during a 72-hour window with free BundleCart shipping.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

export function buildBundleStartedEmailTemplate({ activeUntil, orderCount, bundleUrl }) {
  return {
    subject: "Your BundleCart window is open",
    html: buildEmailLayout({
      headline: "Your BundleCart window is open",
      subtext:
        "Pay shipping once, then keep shopping. Orders you add in the next 72 hours can ship free with BundleCart.",
      activeUntil,
      orderCount,
      ctaText: "Continue shopping",
      ctaUrl: bundleUrl,
      secondaryCopy:
        "You can keep adding orders from participating stores with free BundleCart shipping while your window is active.",
      urgencyText: "Your window is open now. Add more orders before it closes."
    })
  };
}

export function buildBundleOrderAddedEmailTemplate({ activeUntil, orderCount, bundleUrl }) {
  return {
    subject: "A new order was added to your BundleCart bundle",
    html: buildEmailLayout({
      headline: "Another order joined your bundle",
      subtext:
        "Great news - your bundle keeps growing. Keep going while your shipping window stays open.",
      activeUntil,
      orderCount,
      ctaText: "Continue shopping",
      ctaUrl: bundleUrl,
      secondaryCopy:
        "You can still add more orders from participating stores with free BundleCart shipping during this same window.",
      urgencyText: "Only a limited time remains to add more orders."
    })
  };
}

export function buildBundleReminderEmailTemplate({ activeUntil, orderCount, bundleUrl }) {
  return {
    subject: "Your BundleCart window closes soon",
    html: buildEmailLayout({
      headline: "Your BundleCart window closes soon",
      subtext:
        "Don't miss your free linked shipping window. Add another order before time runs out.",
      activeUntil,
      orderCount,
      ctaText: "Continue shopping",
      ctaUrl: bundleUrl,
      secondaryCopy:
        "You can keep adding orders from participating stores with free BundleCart shipping until your timer reaches zero.",
      urgencyText: "Your window closes soon. Only a short time is left."
    })
  };
}

export function buildBundleExpiredEmailTemplate({ activeUntil, orderCount, bundleUrl }) {
  return {
    subject: "Your BundleCart shipping window has closed",
    html: buildEmailLayout({
      headline: "Your BundleCart window has closed",
      subtext:
        "Your current bundle window ended. You can start a new bundle the next time you check out with BundleCart.",
      activeUntil,
      orderCount,
      ctaText: "Continue shopping",
      ctaUrl: bundleUrl,
      secondaryCopy:
        "When you place your next BundleCart order, you'll open a new 72-hour window to link more orders.",
      urgencyText: "This window has ended. Start a new bundle on your next order."
    })
  };
}

function getResendClient() {
  if (EMAIL_PROVIDER !== "resend") {
    throw new Error("email_provider_not_configured");
  }
  if (!RESEND_API_KEY || !EMAIL_FROM) {
    throw new Error("missing_resend_email_config");
  }
  if (!resendClient) {
    resendClient = new Resend(RESEND_API_KEY);
  }
  if (!providerConfiguredLogged) {
    console.log("BUNDLECART EMAIL PROVIDER CONFIGURED", EMAIL_PROVIDER);
    providerConfiguredLogged = true;
  }
  return resendClient;
}

export async function sendEmail({ to, subject, html }) {
  const recipient = String(to || "").trim();
  if (!recipient) {
    throw new Error("missing_recipient");
  }

  console.log("BUNDLECART EMAIL SEND START", { to: recipient, subject: String(subject || "") });
  try {
    const client = getResendClient();
    const { data, error } = await client.emails.send({
      from: EMAIL_FROM,
      to: [recipient],
      subject: String(subject || ""),
      html: String(html || "")
    });

    if (error) {
      throw new Error(`resend_error:${JSON.stringify(error)}`);
    }

    console.log("BUNDLECART EMAIL SEND SUCCESS", { to: recipient, email_id: data?.id || null });
  } catch (error) {
    console.error("BUNDLECART EMAIL SEND FAILED", {
      to: recipient,
      subject: String(subject || ""),
      error: error?.message || String(error)
    });
    throw error;
  }
}
