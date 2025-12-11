import { buildApp } from "./app";
import { config } from "./config";
import { logger } from "./utils/logger";

const app = buildApp();
app.listen(config.port, () => {
  logger.info(`API server listening on port ${config.port}`);
});





