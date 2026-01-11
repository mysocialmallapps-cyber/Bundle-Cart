import { useAppBridge } from "@shopify/app-bridge-react";

export type AdminSummary = {
  shopDomain: string;
  totalDecisions: number;
  qualifiedDecisions: number;
  estimatedSavingsCents: number;
};

export type ShippingDecision = {
  request_id: string;
  created_at: string;
  email: string | null;
  qualified: boolean;
  reason: string;
  link_group_id: string | null;
};

export type LinkedOrdersGroup = {
  email: string;
  customerId: string;
  linkGroupId: string;
  windowStart: string | null;
  windowEnd: string | null;
  orders: Array<{
    shopifyOrderId: number;
    orderNumber: string | null;
    placedAt: string;
  }>;
};

async function apiFetch<T>(shopify: any, path: string): Promise<T> {
  // Embedded apps should use an ID token (session token) to authenticate with the backend.
  const token = await shopify.idToken();
  const res = await fetch(path, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export function useBackendClient() {
  const shopify = useAppBridge();
  return {
    getSummary: () => apiFetch<AdminSummary>(shopify, "/api/admin/summary"),
    getShippingDecisions: (limit = 50) =>
      apiFetch<{ decisions: ShippingDecision[] }>(
        shopify,
        `/api/admin/shipping-decisions?limit=${encodeURIComponent(String(limit))}`
      ),
    getLinkedOrders: (limit = 50) =>
      apiFetch<{ groups: LinkedOrdersGroup[] }>(
        shopify,
        `/api/admin/linked-orders?limit=${encodeURIComponent(String(limit))}`
      )
  };
}

