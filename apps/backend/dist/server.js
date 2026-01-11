"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const pino_http_1 = __importDefault(require("pino-http"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const env_1 = require("./config/env");
const logger_1 = require("./config/logger");
const routes_1 = require("./routes");
async function main() {
    const app = (0, express_1.default)();
    app.set("trust proxy", 1);
    app.use((0, pino_http_1.default)({
        logger: logger_1.logger,
        genReqId: (req) => req.headers["x-request-id"] ??
            node_crypto_1.default.randomUUID()
    }));
    app.use((0, cookie_parser_1.default)());
    // JSON parsing is enabled by default for most routes.
    // Webhooks require raw body parsing, so we skip JSON parsing for that path.
    const jsonParser = express_1.default.json({ limit: "1mb" });
    app.use((req, res, next) => {
        if (req.path === "/api/webhooks")
            return next();
        return jsonParser(req, res, next);
    });
    (0, routes_1.registerRoutes)(app);
    app.listen(env_1.env.PORT, () => {
        logger_1.logger.info({ port: env_1.env.PORT }, "Backend listening");
    });
}
void main();
