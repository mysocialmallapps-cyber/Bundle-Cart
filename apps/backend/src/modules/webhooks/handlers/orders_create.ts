import { normalizeEmail, upsertCustomerByEmail } from "../../customers/customers.service";
import {
  attachOrderToLinkGroup,
  countOrdersInLinkGroup,
  insertOrderIdempotent
} from "../../orders/orders.service";
import {
  createLinkGroupAnchoredAt,
  findLinkGroupForCustomerAt
} from "../../linking/linkGroups.service";

type LoggerLike = {
  info?: (obj: any, msg?: string) => void;
  warn?: (obj: any, msg?: string) => void;
  error?: (obj: any, msg?: string) => void;
};

type ShopifyOrdersCreatePayload = {
  id?: number;
  created_at?: string;
  order_number?: number | string;
  email?: string | null;
  customer?: { email?: string | null } | null;
};

function parsePlacedAt(createdAt: string | undefined): Date | null {
  if (!createdAt) return null;
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export async function handleOrdersCreate(input: {
  logger?: LoggerLike;
  merchantId: string | null;
  shopDomain: string;
  payload: unknown;
}): Promise<void> {
  const logger = input.logger;

  if (!input.merchantId) {
    // Can't persist order without a merchant row; still recorded at webhook_events layer.
    logger?.warn?.({ shopDomain: input.shopDomain }, "orders/create received for unknown merchant");
    return;
  }

  const p = input.payload as ShopifyOrdersCreatePayload;
  const shopifyOrderId = p.id;
  const placedAt = parsePlacedAt(p.created_at);
  if (!shopifyOrderId || !placedAt) {
    logger?.warn?.(
      { shopDomain: input.shopDomain, shopifyOrderId, created_at: p.created_at },
      "orders/create missing required fields"
    );
    return;
  }

  const email = normalizeEmail(p.email ?? p.customer?.email ?? null);
  if (!email) {
    // Requirement: identify customers by email. Without email, we cannot link cross-store safely.
    logger?.info?.(
      { shopDomain: input.shopDomain, shopifyOrderId },
      "orders/create missing email; cannot link"
    );
    return;
  }

  const customer = await upsertCustomerByEmail(email);

  const { order } = await insertOrderIdempotent({
    merchantId: input.merchantId,
    shopifyOrderId,
    orderNumber: p.order_number != null ? String(p.order_number) : null,
    customerId: customer.id,
    emailSnapshot: email,
    placedAt
  });

  // If already linked, keep idempotent behavior (no duplicate logs / updates).
  if (order.link_group_id) return;

  const existingGroup = await findLinkGroupForCustomerAt({
    customerId: customer.id,
    placedAt
  });

  if (!existingGroup) {
    logger?.info?.(
      { email, customerId: customer.id, shopifyOrderId },
      "First order placed"
    );
    const group = await createLinkGroupAnchoredAt({ customerId: customer.id, placedAt });
    await attachOrderToLinkGroup({ orderId: order.id, linkGroupId: group.id });
    logger?.info?.({ linkGroupId: group.id, customerId: customer.id }, "Created new link group");
    return;
  }

  const countBefore = await countOrdersInLinkGroup(existingGroup.id);
  if (countBefore === 1) {
    logger?.info?.(
      { linkGroupId: existingGroup.id, customerId: customer.id, shopifyOrderId },
      "Second order detected"
    );
  }

  await attachOrderToLinkGroup({ orderId: order.id, linkGroupId: existingGroup.id });
  logger?.info?.(
    { linkGroupId: existingGroup.id, customerId: customer.id, shopifyOrderId },
    "Updated link group"
  );
}

