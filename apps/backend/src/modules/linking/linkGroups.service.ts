import { pool } from "../../db/pool";

export type LinkGroupRow = {
  id: string;
  customer_id: string;
  window_start: string;
  window_end: string;
};

/**
 * Rolling 24-hour window logic:
 * - A group is anchored at the first order time (`window_start`).
 * - Any order placed within [window_start, window_end] joins that group.
 * - If no group matches, create a new one anchored at the current order.
 *
 * Trade-off: this is deterministic and easy to reason about, but does not "extend"
 * the window with each new order (we intentionally anchor to the first order).
 */
export async function findLinkGroupForCustomerAt(input: {
  customerId: string;
  placedAt: Date;
}): Promise<LinkGroupRow | null> {
  const res = await pool.query<LinkGroupRow>(
    `
      SELECT id, customer_id, window_start, window_end
      FROM link_groups
      WHERE customer_id = $1
        AND $2::timestamptz >= window_start
        AND $2::timestamptz <= window_end
      ORDER BY window_start DESC
      LIMIT 1
    `,
    [input.customerId, input.placedAt]
  );
  return res.rows[0] ?? null;
}

export async function createLinkGroupAnchoredAt(input: {
  customerId: string;
  placedAt: Date;
}): Promise<LinkGroupRow> {
  const res = await pool.query<LinkGroupRow>(
    `
      INSERT INTO link_groups (customer_id, window_start, window_end, created_at, updated_at)
      VALUES ($1, $2, $2 + INTERVAL '24 hours', NOW(), NOW())
      RETURNING id, customer_id, window_start, window_end
    `,
    [input.customerId, input.placedAt]
  );
  if (res.rowCount !== 1) throw new Error("Failed to create link group");
  return res.rows[0]!;
}

