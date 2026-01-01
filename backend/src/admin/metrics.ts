/**
 * Admin Metrics Service
 * Collects and exposes system health metrics
 */

import { logger } from "../utils/logger";

interface RequestMetric {
  path: string;
  method: string;
  statusCode: number;
  duration: number;
  timestamp: Date;
}

interface SystemHealth {
  uptime: number;
  uptimeFormatted: string;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  cpuUsage: NodeJS.CpuUsage;
  nodeVersion: string;
  platform: string;
}

interface MetricsSummary {
  health: SystemHealth;
  requests: {
    total: number;
    last24h: number;
    lastHour: number;
    averageResponseTime: number;
    errorRate: number;
    byStatus: Record<string, number>;
    slowestEndpoints: Array<{ path: string; avgDuration: number; count: number }>;
  };
  errors: {
    total: number;
    last24h: number;
    recent: Array<{ path: string; error: string; timestamp: string }>;
  };
}

// In-memory metrics storage (would use Redis in production)
const requestMetrics: RequestMetric[] = [];
const errorLogs: Array<{ path: string; error: string; timestamp: Date }> = [];
const MAX_METRICS = 10000;
const MAX_ERRORS = 1000;

let startTime = Date.now();

/**
 * Record a request metric
 */
export function recordRequest(
  path: string,
  method: string,
  statusCode: number,
  duration: number
) {
  requestMetrics.push({
    path: normalizePath(path),
    method,
    statusCode,
    duration,
    timestamp: new Date()
  });

  // Keep only recent metrics
  if (requestMetrics.length > MAX_METRICS) {
    requestMetrics.shift();
  }
}

/**
 * Record an error
 */
export function recordError(path: string, error: string) {
  errorLogs.push({
    path: normalizePath(path),
    error: error.slice(0, 500),
    timestamp: new Date()
  });

  if (errorLogs.length > MAX_ERRORS) {
    errorLogs.shift();
  }
}

/**
 * Normalize path to remove IDs for aggregation
 */
function normalizePath(path: string): string {
  return path
    .replace(/\/[a-f0-9-]{20,}/gi, "/:id")
    .replace(/\/\d+/g, "/:num");
}

/**
 * Get system health
 */
export function getSystemHealth(): SystemHealth {
  const uptimeMs = Date.now() - startTime;
  const mem = process.memoryUsage();
  
  return {
    uptime: uptimeMs,
    uptimeFormatted: formatUptime(uptimeMs),
    memoryUsage: {
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      external: Math.round(mem.external / 1024 / 1024),
      rss: Math.round(mem.rss / 1024 / 1024)
    },
    cpuUsage: process.cpuUsage(),
    nodeVersion: process.version,
    platform: process.platform
  };
}

/**
 * Format uptime to human readable string
 */
function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Get metrics summary
 */
export function getMetricsSummary(): MetricsSummary {
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;

  const last24h = requestMetrics.filter(m => now - m.timestamp.getTime() < day);
  const lastHour = last24h.filter(m => now - m.timestamp.getTime() < hour);

  // Calculate stats
  const avgResponseTime = last24h.length > 0
    ? last24h.reduce((sum, m) => sum + m.duration, 0) / last24h.length
    : 0;

  const errors = last24h.filter(m => m.statusCode >= 400);
  const errorRate = last24h.length > 0 ? errors.length / last24h.length : 0;

  // Group by status code
  const byStatus: Record<string, number> = {};
  for (const m of last24h) {
    const key = `${Math.floor(m.statusCode / 100)}xx`;
    byStatus[key] = (byStatus[key] || 0) + 1;
  }

  // Find slowest endpoints
  const pathStats: Record<string, { totalDuration: number; count: number }> = {};
  for (const m of last24h) {
    if (!pathStats[m.path]) {
      pathStats[m.path] = { totalDuration: 0, count: 0 };
    }
    pathStats[m.path].totalDuration += m.duration;
    pathStats[m.path].count += 1;
  }

  const slowestEndpoints = Object.entries(pathStats)
    .map(([path, stats]) => ({
      path,
      avgDuration: Math.round(stats.totalDuration / stats.count),
      count: stats.count
    }))
    .sort((a, b) => b.avgDuration - a.avgDuration)
    .slice(0, 10);

  // Recent errors
  const recentErrors = errorLogs
    .filter(e => now - e.timestamp.getTime() < day)
    .slice(-20)
    .reverse()
    .map(e => ({
      path: e.path,
      error: e.error,
      timestamp: e.timestamp.toISOString()
    }));

  return {
    health: getSystemHealth(),
    requests: {
      total: requestMetrics.length,
      last24h: last24h.length,
      lastHour: lastHour.length,
      averageResponseTime: Math.round(avgResponseTime),
      errorRate: Math.round(errorRate * 1000) / 10, // Percentage with 1 decimal
      byStatus,
      slowestEndpoints
    },
    errors: {
      total: errorLogs.length,
      last24h: errors.length,
      recent: recentErrors
    }
  };
}

/**
 * Reset metrics (for testing)
 */
export function resetMetrics() {
  requestMetrics.length = 0;
  errorLogs.length = 0;
  startTime = Date.now();
}


