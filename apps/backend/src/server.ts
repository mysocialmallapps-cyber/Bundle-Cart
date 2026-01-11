import express from "express";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import crypto from "node:crypto";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { registerRoutes } from "./routes";

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
  // Webhooks require raw body parsing, so we skip JSON parsing for that path.
  const jsonParser = express.json({ limit: "1mb" });
  app.use((req, res, next) => {
    if (req.path === "/api/webhooks") return next();
    return jsonParser(req, res, next);
  });

  registerRoutes(app);

  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "Backend listening");
  });
}

void main();

