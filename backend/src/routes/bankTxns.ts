import { Router } from "express";
import { BankTxnService } from "../core/bankTxns";

export const buildBankTxnsRouter = (bankTxns: BankTxnService) => {
  const router = Router();

  // List transactions
  router.get("/", (req, res) => {
    try {
      const orgId = (req.query.orgId as string) || "demo-org";
      const status = req.query.status as any;
      const bankAccountId = req.query.bankAccountId as string | undefined;
      const list = bankTxns.list(orgId, { status, bankAccountId });
      res.json(list);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Get single transaction
  router.get("/:id", (req, res) => {
    try {
      const txn = bankTxns.get(req.params.id);
      if (!txn) return res.status(404).json({ error: "Not found" });
      res.json(txn);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Create manual transaction
  router.post("/", (req, res) => {
    try {
      const txn = bankTxns.create(req.body);
      res.status(201).json(txn);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Categorize
  router.post("/:id/categorize", (req, res) => {
    try {
      const actorId = (req as any).user?.sub || "unknown";
      const { category, accountId } = req.body;
      const txn = bankTxns.categorize(req.params.id, category, accountId, actorId);
      res.json(txn);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Mark reconciled
  router.post("/:id/reconcile", (req, res) => {
    try {
      const actorId = (req as any).user?.sub || "unknown";
      const txn = bankTxns.markReconciled(req.params.id, actorId);
      res.json(txn);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Split transaction
  router.post("/:id/split", (req, res) => {
    try {
      const actorId = (req as any).user?.sub || "unknown";
      const { splits } = req.body;
      const created = bankTxns.splitTransaction(req.params.id, splits, actorId);
      res.json(created);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Bulk import CSV
  router.post("/import", (req, res) => {
    try {
      const { orgId, bankAccountId, currency, rows } = req.body;
      const created = bankTxns.bulkImportCsv(orgId || "demo-org", bankAccountId, currency || "USD", rows);
      res.json({ imported: created.length, transactions: created });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Summary
  router.get("/reports/summary", (req, res) => {
    try {
      const orgId = (req.query.orgId as string) || "demo-org";
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const summary = bankTxns.summary(orgId, startDate, endDate);
      res.json(summary);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  return router;
};

