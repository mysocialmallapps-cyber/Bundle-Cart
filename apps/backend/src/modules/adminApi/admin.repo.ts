import { pool } from "../../db/pool";

export async function listShippingDecisionsForMerchant(input: {
  merchantId: string;
  limit: number;
}) {
  const res = await pool.query<{
    request_id: string;
    created_at: string;
    email: string | null;
    qualified: boolean;
    reason: string;
    link_group_id: string | null;
  }>(
    `
      SELECT request_id, created_at, email, qualified, reason, link_group_id
      FROM shipping_decisions
      WHERE merchant_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [input.merchantId, input.limit]
  );
  return res.rows;
}

export async function getMerchantShippingSummary(input: { merchantId: string }) {
  const res = await pool.query<{
    total_decisions: string;
    qualified_decisions: string;
  }>(
    `
      SELECT
        COUNT(*)::text AS total_decisions,
        SUM(CASE WHEN qualified THEN 1 ELSE 0 END)::text AS qualified_decisions
      FROM shipping_decisions
      WHERE merchant_id = $1
    `,
    [input.merchantId]
  );

  const row = res.rows[0] ?? { total_decisions: "0", qualified_decisions: "0" };
  return {
    totalDecisions: Number(row.total_decisions ?? 0),
    qualifiedDecisions: Number(row.qualified_decisions ?? 0),
    // We don't know the "would-have-paid" baseline shipping amount yet (no pricing/config).
    // Keep this as 0 for now; UI will display as "estimated".
    estimatedSavingsCents: 0
  };
}

export async function listLinkedOrdersForMerchant(input: {
  merchantId: string;
  limitGroups: number;
}) {
  const res = await pool.query<{
    email: string;
    customer_id: string;
    link_group_id: string;
    window_start: string | null;
    window_end: string | null;
    orders: any;
    last_order_at: string;
  }>(
    `
      SELECT
        c.email::text AS email,
        o.customer_id,
        o.link_group_id,
        lg.window_start,
        lg.window_end,
        MAX(o.placed_at) AS last_order_at,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'shopifyOrderId', o.shopify_order_id,
            'orderNumber', o.order_number,
            'placedAt', o.placed_at
          )
          ORDER BY o.placed_at DESC
        ) AS orders
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      LEFT JOIN link_groups lg ON lg.id = o.link_group_id
      WHERE o.merchant_id = $1
        AND o.link_group_id IS NOT NULL
      GROUP BY c.email, o.customer_id, o.link_group_id, lg.window_start, lg.window_end
      ORDER BY last_order_at DESC
      LIMIT $2
    `,
    [input.merchantId, input.limitGroups]
  );

  // IMPORTANT: We return ONLY this merchant's orders; we do not expose cross-merchant orders.
  return res.rows.map((r) => ({
    email: r.email,
    customerId: r.customer_id,
    linkGroupId: r.link_group_id,
    windowStart: r.window_start,
    windowEnd: r.window_end,
    orders: r.orders as Array<{ shopifyOrderId: number; orderNumber: string | null; placedAt: string }>
  }));
}

