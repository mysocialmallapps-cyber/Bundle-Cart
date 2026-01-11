const SHOP_DOMAIN_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;

export function normalizeShopDomain(input: string | undefined | null): string | null {
  if (!input) return null;
  const shop = input.trim().toLowerCase();
  if (!SHOP_DOMAIN_RE.test(shop)) return null;
  return shop;
}

