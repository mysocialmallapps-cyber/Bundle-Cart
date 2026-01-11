import { env } from "../../config/env";
import { shopifyRestRequest } from "../../shopify/adminRest";
import { updateMerchantCarrierServiceId } from "../merchants/merchants.repo";

type LoggerLike = {
  info?: (obj: any, msg?: string) => void;
  warn?: (obj: any, msg?: string) => void;
  error?: (obj: any, msg?: string) => void;
};

type ShopifyCarrierService = {
  id: number;
  name: string;
  callback_url: string;
  service_discovery: boolean;
  active?: boolean;
};

type CarrierServicesListResponse = { carrier_services: ShopifyCarrierService[] };
type CarrierServiceCreateResponse = { carrier_service: ShopifyCarrierService };
type CarrierServiceUpdateResponse = { carrier_service: ShopifyCarrierService };

const CARRIER_NAME = "BundleCart";

function carrierCallbackUrl(shopDomain: string): string {
  // We include `shop` because carrier callbacks do not have a reliable signed identifier.
  // This does not provide cryptographic authentication, but it allows us to route to the right merchant safely.
  const url = new URL("/api/carrier/rates", env.APP_URL);
  url.searchParams.set("shop", shopDomain);
  return url.toString();
}

export async function registerCarrierServiceOnInstall(input: {
  shopDomain: string;
  accessToken: string;
  merchantId: string;
  logger?: LoggerLike;
}): Promise<void> {
  const callbackUrl = carrierCallbackUrl(input.shopDomain);

  const list = await shopifyRestRequest<CarrierServicesListResponse>({
    shopDomain: input.shopDomain,
    accessToken: input.accessToken,
    method: "GET",
    path: "/carrier_services.json"
  });

  const existing = list.carrier_services.find((cs) => cs.name === CARRIER_NAME);

  if (!existing) {
    const created = await shopifyRestRequest<CarrierServiceCreateResponse>({
      shopDomain: input.shopDomain,
      accessToken: input.accessToken,
      method: "POST",
      path: "/carrier_services.json",
      body: {
        carrier_service: {
          name: CARRIER_NAME,
          callback_url: callbackUrl,
          service_discovery: true
        }
      }
    });

    await updateMerchantCarrierServiceId({
      merchantId: input.merchantId,
      carrierServiceId: created.carrier_service.id
    });
    input.logger?.info?.(
      { carrierServiceId: created.carrier_service.id, shopDomain: input.shopDomain },
      "Carrier service created"
    );
    return;
  }

  // Keep Shopify registration aligned with our deployed callback URL.
  if (existing.callback_url !== callbackUrl || existing.service_discovery !== true) {
    const updated = await shopifyRestRequest<CarrierServiceUpdateResponse>({
      shopDomain: input.shopDomain,
      accessToken: input.accessToken,
      method: "PUT",
      path: `/carrier_services/${existing.id}.json`,
      body: {
        carrier_service: {
          id: existing.id,
          name: CARRIER_NAME,
          callback_url: callbackUrl,
          service_discovery: true
        }
      }
    });
    await updateMerchantCarrierServiceId({
      merchantId: input.merchantId,
      carrierServiceId: updated.carrier_service.id
    });
    input.logger?.info?.(
      { carrierServiceId: updated.carrier_service.id, shopDomain: input.shopDomain },
      "Carrier service updated"
    );
    return;
  }

  // Already correct.
  await updateMerchantCarrierServiceId({
    merchantId: input.merchantId,
    carrierServiceId: existing.id
  });
  input.logger?.info?.(
    { carrierServiceId: existing.id, shopDomain: input.shopDomain },
    "Carrier service already registered"
  );
}

