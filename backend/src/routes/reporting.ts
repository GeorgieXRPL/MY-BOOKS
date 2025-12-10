import { Router } from "express";
import { ReportingService } from "../core/reporting";
import { ReconciliationService } from "../core/reconciliation";
import { requireRoles } from "../middleware/auth";

export const buildReportingRouter = (
  reporting: ReportingService,
  recon: ReconciliationService
) => {
  const router = Router();

  router.get("/balance-sheet", requireRoles(["viewer", "admin", "auditor"]), (req, res) => {
    const { orgId, period } = req.query;
    if (!orgId || typeof orgId !== "string") return res.status(400).json({ error: "orgId required" });
    try {
      return res.json(reporting.balanceSheet(orgId, typeof period === "string" ? period : undefined));
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.get("/income-statement", requireRoles(["viewer", "admin", "auditor"]), (req, res) => {
    const { orgId, period } = req.query;
    if (!orgId || typeof orgId !== "string") return res.status(400).json({ error: "orgId required" });
    try {
      return res.json(reporting.incomeStatement(orgId, typeof period === "string" ? period : undefined));
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.get("/cash-flow", requireRoles(["viewer", "admin", "auditor"]), (req, res) => {
    const { orgId, period } = req.query;
    if (!orgId || typeof orgId !== "string") return res.status(400).json({ error: "orgId required" });
    try {
      return res.json(reporting.cashFlow(orgId, typeof period === "string" ? period : undefined));
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
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

