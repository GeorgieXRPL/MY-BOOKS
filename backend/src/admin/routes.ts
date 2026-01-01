/**
 * Admin Routes
 * Protected admin-only endpoints for system management
 */

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { getMetricsSummary, getSystemHealth, recordError } from "./metrics";
import { 
  createImpersonationToken, 
  endImpersonation, 
  getActiveSessions 
} from "./impersonate";
import { AuthenticatedRequest, requireRoles } from "../middleware/auth";
import { logger } from "../utils/logger";

// IP allowlist for admin routes (optional extra security)
const ADMIN_IP_ALLOWLIST = process.env.ADMIN_IP_ALLOWLIST?.split(",").map(ip => ip.trim()) || [];

/**
 * IP allowlist middleware
 */
function ipAllowlist(req: Request, res: Response, next: NextFunction) {
  if (ADMIN_IP_ALLOWLIST.length === 0) {
    return next(); // No allowlist configured, allow all
  }

  const clientIp = req.ip || req.socket.remoteAddress || "";
  const forwardedFor = req.headers["x-forwarded-for"];
  const checkIp = (typeof forwardedFor === "string" ? forwardedFor.split(",")[0] : clientIp).trim();

  if (ADMIN_IP_ALLOWLIST.includes(checkIp) || ADMIN_IP_ALLOWLIST.includes("*")) {
    return next();
  }

  logger.warn("Admin access denied from IP", { ip: checkIp, path: req.path });
  return res.status(403).json({ error: "Access denied from this IP" });
}

export const buildAdminRouter = (store: any) => {
  const router = Router();

  // All admin routes require admin role and optionally IP check
  router.use(requireRoles(["admin"]));
  router.use(ipAllowlist);

  // ============ HEALTH & METRICS ============

  // Get system health
  router.get("/health", (_req, res) => {
    res.json(getSystemHealth());
  });

  // Get detailed metrics
  router.get("/metrics", (_req, res) => {
    res.json(getMetricsSummary());
  });

  // ============ USER MANAGEMENT ============

  // List all users (across all orgs)
  router.get("/users", async (_req, res) => {
    try {
      // Get all orgs first, then users per org
      // For simplicity, we'll get users from demo-org for now
      // In production, you'd have an orgs table
      const users = await Promise.resolve(store.listUsersByOrg("demo-org"));
      res.json(users);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Get user details
  router.get("/users/:id", async (req, res) => {
    try {
      const user = await Promise.resolve(store.getUserById(req.params.id));
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(user);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Update user (admin can change roles, active status)
  const updateUserSchema = z.object({
    name: z.string().optional(),
    roles: z.array(z.string()).optional(),
    isActive: z.boolean().optional()
  });

  router.patch("/users/:id", async (req, res) => {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);

    try {
      const updated = await Promise.resolve(store.updateUser(req.params.id, parsed.data));
      res.json(updated);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ============ IMPERSONATION ============

  // Start impersonation
  const impersonateSchema = z.object({
    userId: z.string(),
    reason: z.string().min(5),
    durationMinutes: z.number().min(5).max(120).optional()
  });

  router.post("/impersonate", async (req: AuthenticatedRequest, res) => {
    const parsed = impersonateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);

    const { userId, reason, durationMinutes } = parsed.data;

    try {
      // Get target user
      const targetUser = await Promise.resolve(store.getUserById(userId));
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }

      // Create impersonation token
      const token = createImpersonationToken(
        req.user?.id || "unknown-admin",
        targetUser,
        reason,
        durationMinutes
      );

      // Log to audit
      await Promise.resolve(store.addAudit({
        orgId: targetUser.orgId,
        actorId: req.user?.id || "unknown",
        action: "impersonate.start",
        entity: "user",
        entityId: userId,
        after: { reason, durationMinutes }
      }));

      res.json({ 
        success: true, 
        token,
        targetUser: {
          id: targetUser.id,
          email: targetUser.email,
          name: targetUser.name,
          orgId: targetUser.orgId
        }
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // End impersonation
  router.post("/impersonate/end", (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "Token required" });

    const ended = endImpersonation(token);
    res.json({ success: ended });
  });

  // List active impersonation sessions
  router.get("/impersonate/sessions", (_req, res) => {
    res.json(getActiveSessions());
  });

  // ============ AUDIT LOGS ============

  // Search audit logs
  const auditSearchSchema = z.object({
    orgId: z.string().optional(),
    actorId: z.string().optional(),
    action: z.string().optional(),
    entity: z.string().optional(),
    limit: z.number().min(1).max(1000).optional()
  });

  router.post("/audit/search", async (req, res) => {
    const parsed = auditSearchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);

    try {
      const { orgId = "demo-org", limit = 100 } = parsed.data;
      let logs = await Promise.resolve(store.listAudit(orgId));

      // Filter by criteria
      if (parsed.data.actorId) {
        logs = logs.filter((l: any) => l.actorId === parsed.data.actorId);
      }
      if (parsed.data.action) {
        logs = logs.filter((l: any) => l.action.includes(parsed.data.action));
      }
      if (parsed.data.entity) {
        logs = logs.filter((l: any) => l.entity === parsed.data.entity);
      }

      res.json(logs.slice(0, limit));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ============ FEATURE FLAGS ============
  // Simple in-memory feature flags (use database in production)
  const featureFlags: Record<string, { enabled: boolean; description: string }> = {
    "blockchain-auto-ingest": { enabled: true, description: "Enable blockchain TX auto-ingestion" },
    "ocr-scanning": { enabled: true, description: "Enable OCR invoice scanning" },
    "ai-chatbot": { enabled: false, description: "Enable AI chatbot assistant" }
  };

  router.get("/feature-flags", (_req, res) => {
    res.json(featureFlags);
  });

  router.patch("/feature-flags/:flag", (req, res) => {
    const { flag } = req.params;
    const { enabled } = req.body;

    if (featureFlags[flag] === undefined) {
      return res.status(404).json({ error: "Feature flag not found" });
    }

    featureFlags[flag].enabled = enabled;
    logger.info("Feature flag updated", { flag, enabled });
    res.json({ [flag]: featureFlags[flag] });
  });

  // ============ DATABASE STATS ============

  router.get("/db/stats", async (_req, res) => {
    try {
      const orgId = "demo-org";
      
      // Get counts from store
      const stats = {
        accounts: (await Promise.resolve(store.listAccounts(orgId))).length,
        journals: (await Promise.resolve(store.listJournals(orgId))).length,
        invoices: (await Promise.resolve(store.listInvoices(orgId))).length,
        expenses: (await Promise.resolve(store.listExpenses(orgId))).length,
        employees: (await Promise.resolve(store.listEmployees(orgId))).length,
        wallets: (await Promise.resolve(store.listWallets(orgId))).length,
        cryptoTransactions: (await Promise.resolve(store.listCryptoTransactions(orgId))).length,
        bankTransactions: (await Promise.resolve(store.listBankTransactions(orgId))).length
      };

      res.json(stats);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
};


