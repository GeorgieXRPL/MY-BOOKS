/**
 * Admin Middleware
 * Request tracking and metrics collection
 */

import { Request, Response, NextFunction } from "express";
import { recordRequest, recordError } from "./metrics";

/**
 * Metrics middleware - tracks request timing and status
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();

  // Intercept response finish to record metrics
  res.on("finish", () => {
    const duration = Date.now() - startTime;
    recordRequest(req.path, req.method, res.statusCode, duration);

    // Record errors
    if (res.statusCode >= 400) {
      recordError(req.path, `${res.statusCode} ${res.statusMessage || ""}`);
    }
  });

  next();
}

/**
 * Error handling middleware for unhandled errors
 */
export function errorMetricsMiddleware(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  recordError(req.path, err.message);
  next(err);
}
