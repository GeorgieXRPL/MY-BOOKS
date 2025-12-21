import { Router } from "express";
import { BankTxnService } from "../core/bankTxns";

export const buildBankTxnsRouter = (bankTxns: BankTxnService) => {
  const router = Router();

  // List transactions
  router.get("/", async (req, res) => {
    try {
      const orgId = (req.query.orgId as string) || "demo-org";
      const status = req.query.status as any;
      const bankAccountId = req.query.bankAccountId as string | undefined;
      const list = await bankTxns.list(orgId, { status, bankAccountId });
      res.json(list);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Get single transaction
  router.get("/:id", async (req, res) => {
    try {
      const txn = await bankTxns.get(req.params.id);
      if (!txn) return res.status(404).json({ error: "Not found" });
      res.json(txn);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Create manual transaction
  router.post("/", async (req, res) => {
    try {
      const txn = await bankTxns.create(req.body);
      res.status(201).json(txn);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Categorize
  router.post("/:id/categorize", async (req, res) => {
    try {
      const actorId = (req as any).user?.sub || "unknown";
      const { category, accountId } = req.body;
      const txn = await bankTxns.categorize(req.params.id, category, accountId, actorId);
      res.json(txn);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Mark reconciled
  router.post("/:id/reconcile", async (req, res) => {
    try {
      const actorId = (req as any).user?.sub || "unknown";
      const txn = await bankTxns.markReconciled(req.params.id, actorId);
      res.json(txn);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Split transaction
  router.post("/:id/split", async (req, res) => {
    try {
      const actorId = (req as any).user?.sub || "unknown";
      const { splits } = req.body;
      const created = await bankTxns.splitTransaction(req.params.id, splits, actorId);
      res.json(created);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Bulk import CSV
  router.post("/import", async (req, res) => {
    try {
      const { orgId, bankAccountId, currency, rows } = req.body;
      const created = await bankTxns.bulkImportCsv(orgId || "demo-org", bankAccountId, currency || "USD", rows);
      res.json({ imported: created.length, transactions: created });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Summary
  router.get("/reports/summary", async (req, res) => {
    try {
      const orgId = (req.query.orgId as string) || "demo-org";
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const summary = await bankTxns.summary(orgId, startDate, endDate);
      res.json(summary);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  return router;
};



