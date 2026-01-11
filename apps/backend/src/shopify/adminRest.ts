export const SHOPIFY_API_VERSION = "2025-01";

export async function shopifyRestRequest<T>(input: {
  shopDomain: string;
  accessToken: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string; // e.g. "/webhooks.json"
  body?: unknown;
}): Promise<T> {
  const url = new URL(`https://${input.shopDomain}/admin/api/${SHOPIFY_API_VERSION}${input.path}`);
  const res = await fetch(url, {
    method: input.method,
    headers: {
      "content-type": "application/json",
      "x-shopify-access-token": input.accessToken
    },
    body: input.body ? JSON.stringify(input.body) : undefined
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify REST ${input.method} ${input.path} failed (${res.status}): ${text}`);
  }
  return (await res.json()) as T;
}

