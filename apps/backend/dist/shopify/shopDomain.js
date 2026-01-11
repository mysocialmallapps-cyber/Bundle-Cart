"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeShopDomain = normalizeShopDomain;
const SHOP_DOMAIN_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;
function normalizeShopDomain(input) {
    if (!input)
        return null;
    const shop = input.trim().toLowerCase();
    if (!SHOP_DOMAIN_RE.test(shop))
        return null;
    return shop;
}
