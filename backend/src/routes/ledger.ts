import { Router } from "express";
import { z } from "zod";
import { LedgerService, DraftInput } from "../core/ledger";
import { IStore } from "../core/store.interface";
import { requireRoles } from "../middleware/auth";
import { newId } from "../utils/id";
import { parsePagination, paginateArray } from "../utils/pagination";

export const buildLedgerRouter = (ledger: LedgerService, store: IStore) => {
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

  router.post("/journals", requireRoles(["poster", "admin"]), async (req, res) => {
    const parsed = journalSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);
    try {
      const journal = await ledger.createDraft(parsed.data as DraftInput);
      return res.json(journal);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.post("/journals/:id/review", requireRoles(["approver", "admin"]), async (req, res) => {
    const reviewerId = (req.body?.reviewerId as string) ?? (req as any).user?.id;
    try {
      const journal = await ledger.review(req.params.id, reviewerId);
      return res.json(journal);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.post("/journals/:id/post", requireRoles(["poster", "admin"]), async (req, res) => {
    const posterId = (req.body?.posterId as string) ?? (req as any).user?.id;
    try {
      const journal = await ledger.post(req.params.id, posterId);
      return res.json(journal);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.post("/periods/:period/lock", requireRoles(["admin", "approver"]), async (req, res) => {
    const { orgId, lockedBy } = req.body ?? {};
    if (!orgId) return res.status(400).json({ error: "orgId required" });
    try {
      await ledger.lockPeriod(orgId, req.params.period, lockedBy ?? (req as any).user?.id);
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.get("/journals", requireRoles(["viewer", "admin", "approver", "poster"]), async (req, res) => {
    const orgId = (req.query.orgId as string) || "demo-org";
    const pagination = parsePagination(req, 50, 200);
    
    // Get all journals (in production, this would be a paginated DB query)
    const allJournals = await ledger.list(orgId);
    
    // Apply pagination
    const result = paginateArray(allJournals, pagination);
    res.json(result);
  });

  router.get("/accounts", requireRoles(["viewer", "admin", "approver", "poster"]), async (req, res) => {
    const orgId = (req.query.orgId as string) || "demo-org";
    const accounts = await Promise.resolve(store.listAccounts(orgId));
    res.json(accounts);
  });

  router.post("/accounts", requireRoles(["admin"]), async (req, res) => {
    try {
      await Promise.resolve(store.upsertAccount({
        id: newId(),
        orgId: req.body.orgId || "demo-org",
        code: req.body.code,
        name: req.body.name,
        type: req.body.type,
        currency: req.body.currency || "USD",
        isActive: req.body.isActive !== false
      }));
      res.status(201).json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
};

