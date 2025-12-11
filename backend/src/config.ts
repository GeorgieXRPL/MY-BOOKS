import dotenv from "dotenv";
import { logger } from "./utils/logger";

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || "dev-secret",
  webhookSecret: process.env.WEBHOOK_SECRET || "webhook-secret",
  priceProvider: process.env.PRICE_PROVIDER || "coingecko",
  defaultCurrency: process.env.DEFAULT_CURRENCY || "USD"
};

logger.info(`Loaded config for env=${process.env.NODE_ENV ?? "development"}`);





