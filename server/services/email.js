import { Resend } from "resend";

const EMAIL_PROVIDER = String(
  process.env.EMAIL_PROVIDER || process.env.BUNDLECART_EMAIL_PROVIDER || ""
)
  .trim()
  .toLowerCase();
const RESEND_API_KEY = String(
  process.env.RESEND_API_KEY || process.env.BUNDLECART_EMAIL_API_KEY || ""
).trim();
const EMAIL_FROM = String(process.env.EMAIL_FROM || process.env.BUNDLECART_EMAIL_FROM || "").trim();

let resendClient = null;
let providerConfiguredLogged = false;

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
