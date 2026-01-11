import type { Express } from "express";
import { requireMerchantSession } from "./auth.middleware";
import {
  getMerchantShippingSummary,
  listLinkedOrdersForMerchant,
  listShippingDecisionsForMerchant
} from "./admin.repo";

export function registerAdminRoutes(app: Express) {
  app.get("/api/admin/summary", requireMerchantSession, async (req, res) => {
    const merchantId = req.merchant!.id;
    const summary = await getMerchantShippingSummary({ merchantId });
    return res.status(200).json({ ...summary, shopDomain: req.merchant!.shopDomain });
  });

  app.get("/api/admin/shipping-decisions", requireMerchantSession, async (req, res) => {
    const merchantId = req.merchant!.id;
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const decisions = await listShippingDecisionsForMerchant({ merchantId, limit });
    return res.status(200).json({ decisions });
  });

  app.get("/api/admin/linked-orders", requireMerchantSession, async (req, res) => {
    const merchantId = req.merchant!.id;
    const limitGroups = Math.min(Number(req.query.limit ?? 50), 200);
    const groups = await listLinkedOrdersForMerchant({ merchantId, limitGroups });
    return res.status(200).json({ groups });
  });
}

