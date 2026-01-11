import type { Request, Response } from "express";
import crypto from "node:crypto";
import { normalizeShopDomain } from "../../shopify/shopDomain";
import { determineEligibility } from "./rates.service";
import { insertShippingDecision } from "./shippingDecisions.repo";
import { findMerchantByShopDomain } from "../merchants/merchants.repo";
import { normalizeEmail } from "../customers/customers.service";

type LoggerLike = {
  info?: (obj: any, msg?: string) => void;
  warn?: (obj: any, msg?: string) => void;
  error?: (obj: any, msg?: string) => void;
};

type CarrierRateRequest = {
  rate?: {
    currency?: string;
    // Email is not guaranteed to be present in carrier callback payloads.
    email?: string | null;
    customer?: { email?: string | null } | null;
    shipping_address?: { email?: string | null } | null;
  };
  customer?: { email?: string | null } | null;
};

function extractEmail(payload: unknown): string | null {
  const p = payload as CarrierRateRequest;
  const raw =
    p?.rate?.email ??
    p?.rate?.customer?.email ??
    p?.rate?.shipping_address?.email ??
    p?.customer?.email ??
    null;
  return normalizeEmail(raw);
}

function extractCurrency(payload: unknown): string {
  const p = payload as CarrierRateRequest;
  return (p?.rate?.currency ?? "USD").toString();
}

function emptyRatesResponse() {
  return { rates: [] as any[] };
}

async function withTimeout<T>(ms: number, fn: () => Promise<T>): Promise<T> {
  // Helper kept small; actual hard timeout is enforced by Promise.race below.
  return await fn();
}

function parseJsonBody(rawBody: unknown): unknown {
  if (Buffer.isBuffer(rawBody)) {
    try {
      return JSON.parse(rawBody.toString("utf8"));
    } catch {
      return null;
    }
  }
  return rawBody;
}

/**
 * Carrier rate callback.
 *
 * IMPORTANT: Shopify controls checkout rendering. We can only influence the
 * rate name/price/description returned by the carrier service; UI styling is
 * limited by Shopify checkout.
 */
export async function carrierRatesCallback(req: Request, res: Response) {
  const logger = (req.log as LoggerLike | undefined) ?? undefined;

  const shopDomain = normalizeShopDomain(req.query.shop as string | undefined);
  if (!shopDomain) return res.status(200).json(emptyRatesResponse());

  const requestId = crypto.randomUUID();
  const payload = parseJsonBody(req.body as unknown);
  if (!payload) {
    // Fail open: never block checkout on malformed JSON.
    await insertShippingDecision({
      requestId,
      merchantId: null,
      shopDomain,
      email: null,
      customerId: null,
      linkGroupId: null,
      qualified: false,
      reason: "invalid_json"
    });
    return res.status(200).json(emptyRatesResponse());
  }
  const email = extractEmail(payload);
  const currency = extractCurrency(payload);

  const merchant = await findMerchantByShopDomain(shopDomain);
  if (!merchant || merchant.uninstalled_at) {
    // Fail open: no BundleCart rate.
    await insertShippingDecision({
      requestId,
      merchantId: merchant?.id ?? null,
      shopDomain,
      email,
      customerId: null,
      linkGroupId: null,
      qualified: false,
      reason: !merchant ? "unknown_merchant" : "merchant_uninstalled"
    });
    return res.status(200).json(emptyRatesResponse());
  }

  // Hard timeout guard: never block checkout. Fail open on timeout/error.
  const HARD_TIMEOUT_MS = 1200;

  try {
    const result = await Promise.race([
      withTimeout(HARD_TIMEOUT_MS, async () =>
        determineEligibility({ email, now: new Date() })
      ),
      new Promise<never>((_resolve, reject) =>
        setTimeout(() => reject(new Error("carrier_timeout")), HARD_TIMEOUT_MS)
      )
    ]);

    if (result.qualified) {
      logger?.info?.(
        {
          requestId,
          shopDomain,
          email,
          merchantId: merchant.id,
          customerId: result.customerId,
          linkGroupId: result.linkGroupId,
          priorOrdersInGroup: result.priorOrdersInGroup
        },
        "BundleCart option shown at checkout"
      );
      logger?.info?.(
        { requestId, shopDomain, email, linkGroupId: result.linkGroupId },
        "Free shipping triggered"
      );

      await insertShippingDecision({
        requestId,
        merchantId: merchant.id,
        shopDomain,
        email,
        customerId: result.customerId,
        linkGroupId: result.linkGroupId,
        qualified: true,
        reason: result.reason
      });

      return res.status(200).json({
        rates: [
          {
            service_name: "BundleCart",
            service_code: "BUNDLECART",
            total_price: "0",
            currency,
            description: "BundleCart shipping"
          }
        ]
      });
    }

    await insertShippingDecision({
      requestId,
      merchantId: merchant.id,
      shopDomain,
      email,
      customerId: null,
      linkGroupId: null,
      qualified: false,
      reason: result.reason
    });
    return res.status(200).json(emptyRatesResponse());
  } catch (err: any) {
    logger?.error?.({ err, requestId, shopDomain, email }, "Carrier callback failed (fail open)");
    await insertShippingDecision({
      requestId,
      merchantId: merchant.id,
      shopDomain,
      email,
      customerId: null,
      linkGroupId: null,
      qualified: false,
      reason: err?.message ?? "error"
    });
    return res.status(200).json(emptyRatesResponse());
  }
}

