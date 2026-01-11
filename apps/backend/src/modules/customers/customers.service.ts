import { pool } from "../../db/pool";

export type Customer = {
  id: string;
  email: string;
};

export function normalizeEmail(input: string | null | undefined): string | null {
  if (!input) return null;
  const email = input.trim().toLowerCase();
  if (!email) return null;
  // Minimal validation; Shopify may send emails with plus-tags, etc.
  if (!email.includes("@")) return null;
  return email;
}

export async function upsertCustomerByEmail(email: string): Promise<Customer> {
  const res = await pool.query<Customer>(
    `
      INSERT INTO customers (email, created_at, updated_at)
      VALUES ($1, NOW(), NOW())
      ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
      RETURNING id, email
    `,
    [email]
  );

  if (res.rowCount !== 1) throw new Error("Failed to upsert customer");
  return res.rows[0]!;
}

export async function findCustomerByEmail(email: string): Promise<Customer | null> {
  const res = await pool.query<Customer>(
    `SELECT id, email FROM customers WHERE email = $1 LIMIT 1`,
    [email]
  );
  return res.rows[0] ?? null;
}

