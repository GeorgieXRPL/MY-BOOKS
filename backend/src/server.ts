import { buildApp } from "./app";
import { config } from "./config";
import { logger } from "./utils/logger";

async function main() {
  try {
    const app = await buildApp();
    app.listen(config.port, () => {
      logger.info(`API server listening on port ${config.port}`);
    });
  } catch (error) {
    logger.error("Failed to start server", error);
    process.exit(1);
  }
}

main();
