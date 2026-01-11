"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertMerchant = upsertMerchant;
exports.findMerchantByShopDomain = findMerchantByShopDomain;
exports.markMerchantUninstalled = markMerchantUninstalled;
const pool_1 = require("../../db/pool");
async function upsertMerchant(input) {
    const res = await pool_1.pool.query(`
      INSERT INTO merchants (
        shop_domain,
        shop_id,
        access_token_ciphertext,
        access_token_iv,
        access_token_tag,
        scopes,
        installed_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      ON CONFLICT (shop_domain) DO UPDATE SET
        shop_id = EXCLUDED.shop_id,
        access_token_ciphertext = EXCLUDED.access_token_ciphertext,
        access_token_iv = EXCLUDED.access_token_iv,
        access_token_tag = EXCLUDED.access_token_tag,
        scopes = EXCLUDED.scopes,
        uninstalled_at = NULL,
        updated_at = NOW()
      RETURNING *
    `, [
        input.shopDomain,
        input.shopId ?? null,
        input.accessTokenCiphertext,
        input.accessTokenIv,
        input.accessTokenTag,
        input.scopes
    ]);
    if (res.rowCount !== 1)
        throw new Error("Failed to upsert merchant");
    return res.rows[0];
}
async function findMerchantByShopDomain(shopDomain) {
    const res = await pool_1.pool.query("SELECT id, shop_domain FROM merchants WHERE shop_domain = $1", [shopDomain]);
    return res.rows[0] ?? null;
}
async function markMerchantUninstalled(shopDomain) {
    await pool_1.pool.query(`
      UPDATE merchants
      SET uninstalled_at = NOW(), updated_at = NOW()
      WHERE shop_domain = $1
    `, [shopDomain]);
}
