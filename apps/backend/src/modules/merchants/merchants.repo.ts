import { pool } from "../../db/pool";

export type MerchantRow = {
  id: string;
  shop_domain: string;
  shop_id: string | null;
  access_token_ciphertext: string;
  access_token_iv: string;
  access_token_tag: string;
  scopes: string;
  installed_at: string;
  uninstalled_at: string | null;
};

export async function upsertMerchant(input: {
  shopDomain: string;
  shopId?: string | number | null;
  accessTokenCiphertext: string;
  accessTokenIv: string;
  accessTokenTag: string;
  scopes: string;
}): Promise<MerchantRow> {
  const res = await pool.query<MerchantRow>(
    `
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
    `,
    [
      input.shopDomain,
      input.shopId ?? null,
      input.accessTokenCiphertext,
      input.accessTokenIv,
      input.accessTokenTag,
      input.scopes
    ]
  );

  if (res.rowCount !== 1) throw new Error("Failed to upsert merchant");
  return res.rows[0]!;
}

export async function findMerchantByShopDomain(
  shopDomain: string
): Promise<Pick<MerchantRow, "id" | "shop_domain"> | null> {
  const res = await pool.query<Pick<MerchantRow, "id" | "shop_domain">>(
    "SELECT id, shop_domain FROM merchants WHERE shop_domain = $1",
    [shopDomain]
  );
  return res.rows[0] ?? null;
}

export async function markMerchantUninstalled(shopDomain: string): Promise<void> {
  await pool.query(
    `
      UPDATE merchants
      SET uninstalled_at = NOW(), updated_at = NOW()
      WHERE shop_domain = $1
    `,
    [shopDomain]
  );
}

