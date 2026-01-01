/**
 * Security Middleware
 * Comprehensive security hardening for the API
 */

import { Request, Response, NextFunction, RequestHandler } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { logger } from "../utils/logger";

// ============ HELMET (Security Headers) ============
export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "data:"],
      connectSrc: ["'self'", "https://api.openai.com", "https://*.alchemy.com"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow loading external resources
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
});

// ============ CORS LOCKDOWN ============
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(",").map(o => o.trim()) || [];

export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;

  // In development, allow all origins
  if (process.env.NODE_ENV !== "production") {
    res.header("Access-Control-Allow-Origin", origin || "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key, X-Webhook-Signature");
    res.header("Access-Control-Allow-Credentials", "true");
    
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    return next();
  }

  // In production, check against allowlist
  if (origin && (ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes("*"))) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key, X-Webhook-Signature");
    res.header("Access-Control-Allow-Credentials", "true");
  }

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
}

// ============ RATE LIMITING ============

// General API rate limit
export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  // Use default keyGenerator which handles IPv6 properly
  validate: { xForwardedForHeader: false },
  handler: (req, res) => {
    logger.warn("Rate limit exceeded", { ip: req.ip, path: req.path });
    res.status(429).json({ error: "Too many requests, please try again later" });
  },
});

// Stricter limit for auth endpoints
export const authRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 login attempts per hour
  message: { error: "Too many authentication attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  // Use default keyGenerator which handles IPv6 properly
  validate: { xForwardedForHeader: false },
  handler: (req, res) => {
    logger.warn("Auth rate limit exceeded", { ip: req.ip });
    res.status(429).json({ error: "Too many authentication attempts, please try again later" });
  },
});

// Rate limit for file uploads
export const uploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 uploads per hour
  message: { error: "Upload limit exceeded, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============ API KEY AUTHENTICATION ============
const API_KEYS = new Map<string, { name: string; permissions: string[] }>();

// Load API keys from environment
function loadApiKeys() {
  const keysEnv = process.env.API_KEYS;
  if (keysEnv) {
    try {
      const keys = JSON.parse(keysEnv);
      for (const key of keys) {
        API_KEYS.set(key.key, { name: key.name, permissions: key.permissions || ["read"] });
      }
      logger.info(`Loaded ${API_KEYS.size} API keys`);
    } catch (e) {
      logger.error("Failed to parse API_KEYS environment variable");
    }
  }
}
loadApiKeys();

export function apiKeyAuth(requiredPermission?: string): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.headers["x-api-key"] as string;
    
    if (!apiKey) {
      return next(); // No API key, continue to JWT auth
    }

    const keyData = API_KEYS.get(apiKey);
    if (!keyData) {
      logger.warn("Invalid API key", { ip: req.ip });
      return res.status(401).json({ error: "Invalid API key" });
    }

    if (requiredPermission && !keyData.permissions.includes(requiredPermission)) {
      return res.status(403).json({ error: "API key lacks required permission" });
    }

    // Attach API key info to request
    (req as any).apiKey = keyData;
    (req as any).isApiKey = true;
    next();
  };
}

// ============ REQUEST SANITIZATION ============
export function sanitizeRequest(req: Request, res: Response, next: NextFunction) {
  // Remove any dangerous characters from query parameters
  if (req.query) {
    for (const key of Object.keys(req.query)) {
      if (typeof req.query[key] === "string") {
        // Remove potential SQL injection/XSS patterns
        req.query[key] = (req.query[key] as string)
          .replace(/[<>'"`;]/g, "")
          .slice(0, 1000); // Limit length
      }
    }
  }
  next();
}

// ============ REQUEST SIZE LIMITS ============
export const requestSizeLimits = {
  json: "2mb",
  urlencoded: "2mb",
  text: "1mb",
};

// ============ SECURITY HEADERS ============
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Additional security headers not covered by helmet
  res.setHeader("X-Request-Id", req.headers["x-request-id"] || crypto.randomUUID());
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  next();
}

// ============ ERROR SANITIZATION ============
export function errorSanitization(err: Error, req: Request, res: Response, next: NextFunction) {
  // Don't leak stack traces in production
  const isProduction = process.env.NODE_ENV === "production";
  
  logger.error("Unhandled error", { 
    error: err.message, 
    path: req.path,
    stack: isProduction ? undefined : err.stack 
  });

  res.status(500).json({
    error: isProduction ? "Internal server error" : err.message,
    requestId: res.getHeader("X-Request-Id")
  });
}

// ============ COMBINED SECURITY MIDDLEWARE ============
export const securityMiddleware: RequestHandler[] = [
  helmetMiddleware as RequestHandler,
  securityHeaders,
  sanitizeRequest,
  generalRateLimit,
];


