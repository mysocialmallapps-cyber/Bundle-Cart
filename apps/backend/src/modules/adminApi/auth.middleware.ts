import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { normalizeShopDomain } from "../../shopify/shopDomain";
import { findMerchantByShopDomain } from "../merchants/merchants.repo";

type ShopifySessionTokenPayload = {
  iss?: string;
  dest?: string;
  aud?: string;
  exp?: number;
  nbf?: number;
  iat?: number;
  sub?: string;
};

declare global {
  // Empty on purpose (keeps this file as a module even if imports change).
}

declare module "express-serve-static-core" {
  interface Request {
    merchant?: { id: string; shopDomain: string };
  }
}

function extractShopDomainFromDest(dest: string | undefined): string | null {
  if (!dest) return null;
  try {
    const url = new URL(dest);
    return normalizeShopDomain(url.hostname);
  } catch {
    return null;
  }
}

export async function requireMerchantSession(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const auth = req.header("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
  if (!token) return res.status(401).json({ error: "missing_bearer_token" });

  let payload: ShopifySessionTokenPayload;
  try {
    payload = jwt.verify(token, env.SHOPIFY_API_SECRET, {
      algorithms: ["HS256"],
      audience: env.SHOPIFY_API_KEY
    }) as ShopifySessionTokenPayload;
  } catch {
    return res.status(401).json({ error: "invalid_session_token" });
  }

  const shopDomain = extractShopDomainFromDest(payload.dest);
  if (!shopDomain) return res.status(401).json({ error: "invalid_shop" });

  const merchant = await findMerchantByShopDomain(shopDomain);
  if (!merchant) return res.status(401).json({ error: "unknown_merchant" });
  if (merchant.uninstalled_at) return res.status(401).json({ error: "merchant_uninstalled" });

  req.merchant = { id: merchant.id, shopDomain };
  return next();
}

