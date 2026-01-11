import { pool } from "../../db/pool";

export type OrderRow = {
  id: string;
  merchant_id: string;
  shopify_order_id: string;
  order_number: string | null;
  customer_id: string;
  email_snapshot: string;
  placed_at: string;
  link_group_id: string | null;
};

export async function insertOrderIdempotent(input: {
  merchantId: string;
  shopifyOrderId: number;
  orderNumber?: string | null;
  customerId: string;
  emailSnapshot: string;
  placedAt: Date;
}): Promise<{ order: OrderRow; inserted: boolean }> {
  const inserted = await pool.query<OrderRow>(
    `
      INSERT INTO orders (
        merchant_id,
        shopify_order_id,
        order_number,
        customer_id,
        email_snapshot,
        placed_at,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      ON CONFLICT (merchant_id, shopify_order_id) DO NOTHING
      RETURNING *
    `,
    [
      input.merchantId,
      input.shopifyOrderId,
      input.orderNumber ?? null,
      input.customerId,
      input.emailSnapshot,
      input.placedAt
    ]
  );

  if (inserted.rowCount === 1) {
    return { order: inserted.rows[0]!, inserted: true };
  }

  const existing = await pool.query<OrderRow>(
    `
      SELECT *
      FROM orders
      WHERE merchant_id = $1 AND shopify_order_id = $2
      LIMIT 1
    `,
    [input.merchantId, input.shopifyOrderId]
  );
  if (existing.rowCount !== 1) throw new Error("Order upsert failed to fetch existing");
  return { order: existing.rows[0]!, inserted: false };
}

export async function attachOrderToLinkGroup(input: {
  orderId: string;
  linkGroupId: string;
}): Promise<void> {
  await pool.query(
    `
      UPDATE orders
      SET link_group_id = $2, updated_at = NOW()
      WHERE id = $1
    `,
    [input.orderId, input.linkGroupId]
  );
}

export async function countOrdersInLinkGroup(linkGroupId: string): Promise<number> {
  const res = await pool.query<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM orders WHERE link_group_id = $1`,
    [linkGroupId]
  );
  return Number(res.rows[0]?.cnt ?? 0);
}

