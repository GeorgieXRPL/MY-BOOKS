import { Router } from "express";
import { z } from "zod";
import { LedgerService } from "../core/ledger";
import { requireRoles } from "../middleware/auth";

export const buildLedgerRouter = (ledger: LedgerService, store: any) => {
  const router = Router();

  const journalSchema = z.object({
    orgId: z.string(),
    period: z.string(),
    memo: z.string().optional(),
    tags: z.array(z.string()).optional(),
    createdBy: z.string(),
    externalRef: z.string().optional(),
    lines: z.array(
      z.object({
        accountId: z.string(),
        debit: z.number(),
        credit: z.number(),
        currency: z.string(),
        description: z.string().optional(),
        walletId: z.string().optional(),
        tokenSymbol: z.string().optional(),
        fxRate: z.number().optional(),
        externalRef: z.string().optional(),
        txHash: z.string().optional()
      })
    )
  });

  router.post("/journals", requireRoles(["poster", "admin"]), (req, res) => {
    const parsed = journalSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);
    try {
      const journal = ledger.createDraft(parsed.data);
      return res.json(journal);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.post("/journals/:id/review", requireRoles(["approver", "admin"]), (req, res) => {
    const reviewerId = (req.body?.reviewerId as string) ?? (req as any).user?.id;
    try {
      const journal = ledger.review(req.params.id, reviewerId);
      return res.json(journal);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.post("/journals/:id/post", requireRoles(["poster", "admin"]), (req, res) => {
    const posterId = (req.body?.posterId as string) ?? (req as any).user?.id;
    try {
      const journal = ledger.post(req.params.id, posterId);
      return res.json(journal);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.post("/periods/:period/lock", requireRoles(["admin", "approver"]), (req, res) => {
    const { orgId, lockedBy } = req.body ?? {};
    if (!orgId) return res.status(400).json({ error: "orgId required" });
    try {
      ledger.lockPeriod(orgId, req.params.period, lockedBy ?? (req as any).user?.id);
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.get("/journals", requireRoles(["viewer", "admin", "approver", "poster"]), (_req, res) => {
    const data = ledger.list("demo-org");
    res.json(data);
  });

  router.get("/accounts", requireRoles(["viewer", "admin", "approver", "poster"]), (req, res) => {
    const orgId = (req.query.orgId as string) || "demo-org";
    res.json(store.listAccounts(orgId));
  });

  router.post("/accounts", requireRoles(["admin"]), (req, res) => {
    try {
      const { newId } = require("../utils/id");
      const account = store.upsertAccount({
        id: newId(),
        orgId: req.body.orgId || "demo-org",
        code: req.body.code,
        name: req.body.name,
        type: req.body.type,
        currency: req.body.currency || "USD",
        isActive: req.body.isActive !== false
      });
      res.status(201).json(account);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
};

