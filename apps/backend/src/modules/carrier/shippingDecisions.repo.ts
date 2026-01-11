import { pool } from "../../db/pool";

export async function insertShippingDecision(input: {
  requestId: string;
  merchantId: string | null;
  shopDomain: string;
  email: string | null;
  customerId: string | null;
  linkGroupId: string | null;
  qualified: boolean;
  reason: string;
}): Promise<void> {
  await pool.query(
    `
      INSERT INTO shipping_decisions (
        request_id,
        merchant_id,
        shop_domain,
        email,
        customer_id,
        link_group_id,
        qualified,
        reason
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
    [
      input.requestId,
      input.merchantId,
      input.shopDomain,
      input.email,
      input.customerId,
      input.linkGroupId,
      input.qualified,
      input.reason
    ]
  );
}

