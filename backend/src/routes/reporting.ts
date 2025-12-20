import { Router } from "express";
import { ReportingService } from "../core/reporting";
import { ReconciliationService } from "../core/reconciliation";
import { requireRoles } from "../middleware/auth";
import { cacheGet, cacheSet, cacheDel } from "../utils/cache";

// Cache TTL for reports (5 minutes)
const REPORT_CACHE_TTL = 300;

export const buildReportingRouter = (
  reporting: ReportingService,
  recon: ReconciliationService
) => {
  const router = Router();

  router.get("/balance-sheet", requireRoles(["viewer", "admin", "auditor"]), async (req, res) => {
    const { orgId, period } = req.query;
    if (!orgId || typeof orgId !== "string") return res.status(400).json({ error: "orgId required" });
    
    const cacheKey = `report:bs:${orgId}:${period || "current"}`;
    
    try {
      // Check cache
      const cached = await cacheGet(cacheKey);
      if (cached) {
        res.setHeader("X-Cache", "HIT");
        return res.json(cached);
      }
      
      const result = reporting.balanceSheet(orgId, typeof period === "string" ? period : undefined);
      await cacheSet(cacheKey, result, REPORT_CACHE_TTL);
      res.setHeader("X-Cache", "MISS");
      return res.json(result);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.get("/income-statement", requireRoles(["viewer", "admin", "auditor"]), async (req, res) => {
    const { orgId, period } = req.query;
    if (!orgId || typeof orgId !== "string") return res.status(400).json({ error: "orgId required" });
    
    const cacheKey = `report:is:${orgId}:${period || "current"}`;
    
    try {
      const cached = await cacheGet(cacheKey);
      if (cached) {
        res.setHeader("X-Cache", "HIT");
        return res.json(cached);
      }
      
      const result = reporting.incomeStatement(orgId, typeof period === "string" ? period : undefined);
      await cacheSet(cacheKey, result, REPORT_CACHE_TTL);
      res.setHeader("X-Cache", "MISS");
      return res.json(result);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.get("/cash-flow", requireRoles(["viewer", "admin", "auditor"]), async (req, res) => {
    const { orgId, period } = req.query;
    if (!orgId || typeof orgId !== "string") return res.status(400).json({ error: "orgId required" });
    
    const cacheKey = `report:cf:${orgId}:${period || "current"}`;
    
    try {
      const cached = await cacheGet(cacheKey);
      if (cached) {
        res.setHeader("X-Cache", "HIT");
        return res.json(cached);
      }
      
      const result = reporting.cashFlow(orgId, typeof period === "string" ? period : undefined);
      await cacheSet(cacheKey, result, REPORT_CACHE_TTL);
      res.setHeader("X-Cache", "MISS");
      return res.json(result);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });
  
  // Invalidate report cache (called when ledger changes)
  router.post("/invalidate-cache", requireRoles(["admin"]), async (req, res) => {
    const { orgId } = req.body;
    if (!orgId) return res.status(400).json({ error: "orgId required" });
    
    await cacheDel(`report:bs:${orgId}:*`);
    await cacheDel(`report:is:${orgId}:*`);
    await cacheDel(`report:cf:${orgId}:*`);
    
    return res.json({ success: true, message: "Report cache invalidated" });
  });

  router.get("/treasury", requireRoles(["viewer", "admin", "auditor"]), (req, res) => {
    const { orgId } = req.query;
    if (!orgId || typeof orgId !== "string") return res.status(400).json({ error: "orgId required" });
    try {
      return res.json(reporting.treasury(orgId));
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.get("/reconciliations", requireRoles(["viewer", "admin", "auditor"]), (req, res) => {
    const { orgId } = req.query;
    if (!orgId || typeof orgId !== "string") return res.status(400).json({ error: "orgId required" });
    try {
      return res.json(recon.list(orgId));
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.post("/reconciliations", requireRoles(["approver", "admin"]), (req, res) => {
    const { orgId, source, externalRef, externalBalance, ledgerBalance, note } = req.body ?? {};
    if (!orgId || !source || !externalRef)
      return res.status(400).json({ error: "orgId, source, externalRef required" });
    try {
      const item = recon.reconcile({
        orgId,
        source,
        externalRef,
        externalBalance: Number(externalBalance ?? 0),
        ledgerBalance: Number(ledgerBalance ?? 0),
        note
      });
      return res.json(item);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  return router;
};

