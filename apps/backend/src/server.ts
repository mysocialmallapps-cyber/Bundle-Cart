import express from "express";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import crypto from "node:crypto";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { registerRoutes } from "./routes";
import { registerAdminUiStatic } from "./modules/adminUi/staticUi";

async function main() {
  const app = express();

  app.set("trust proxy", 1);

  app.use(
    pinoHttp({
      logger,
      genReqId: (req) =>
        (req.headers["x-request-id"] as string | undefined) ??
        crypto.randomUUID()
    })
  );

  app.use(cookieParser());

  // JSON parsing is enabled by default for most routes.
  // Webhooks + carrier callback use raw body parsing; we skip JSON parsing for those paths
  // to avoid signature issues (webhooks) and to fail-open on malformed JSON (carrier).
  const jsonParser = express.json({ limit: "1mb" });
  app.use((req, res, next) => {
    if (req.path === "/api/webhooks") return next();
    if (req.path === "/api/carrier/rates") return next();
    return jsonParser(req, res, next);
  });

  registerRoutes(app);
  registerAdminUiStatic(app);

  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "Backend listening");
  });
}

void main();

