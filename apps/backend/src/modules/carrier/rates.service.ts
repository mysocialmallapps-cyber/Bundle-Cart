import { findCustomerByEmail } from "../customers/customers.service";
import { findLinkGroupForCustomerAt } from "../linking/linkGroups.service";
import { countOrdersInLinkGroup } from "../orders/orders.service";

export type CarrierEligibilityResult =
  | {
      qualified: true;
      reason: string;
      customerId: string;
      linkGroupId: string;
      priorOrdersInGroup: number;
    }
  | { qualified: false; reason: string };

/**
 * Determines eligibility for showing the BundleCart rate at checkout.
 *
 * We evaluate against existing orders only. If there is at least 1 prior order
 * in an active link group window, then this checkout would be the 2nd order
 * in that group and qualifies for BundleCart shipping.
 */
export async function determineEligibility(input: {
  email: string | null;
  now: Date;
}): Promise<CarrierEligibilityResult> {
  if (!input.email) return { qualified: false, reason: "no_email" };

  const customer = await findCustomerByEmail(input.email);
  if (!customer) return { qualified: false, reason: "no_customer" };

  const group = await findLinkGroupForCustomerAt({
    customerId: customer.id,
    placedAt: input.now
  });
  if (!group) return { qualified: false, reason: "no_active_link_group" };

  const prior = await countOrdersInLinkGroup(group.id);
  if (prior >= 1) {
    return {
      qualified: true,
      reason: `active_link_group_prior_orders=${prior}`,
      customerId: customer.id,
      linkGroupId: group.id,
      priorOrdersInGroup: prior
    };
  }

  return { qualified: false, reason: "link_group_has_no_orders" };
}

