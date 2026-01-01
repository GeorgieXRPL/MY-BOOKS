/**
 * Admin Module
 * System administration, monitoring, and user management
 */

export { buildAdminRouter } from "./routes";
export { metricsMiddleware, errorMetricsMiddleware } from "./middleware";
export { 
  getMetricsSummary, 
  getSystemHealth, 
  recordRequest, 
  recordError 
} from "./metrics";
export { 
  createImpersonationToken, 
  endImpersonation, 
  getActiveSessions,
  isImpersonationToken 
} from "./impersonate";


