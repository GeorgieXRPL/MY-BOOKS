import { Router } from "express";
import { z } from "zod";
import { WalletIngestor, WalletTransfer } from "../core/ingestion/wallet";
import { CexIngestor, CexTrade } from "../core/ingestion/cex";
import { BankIngestor, BankTxn } from "../core/ingestion/bank";
import { AutoIngestService, detectChain } from "../core/blockchain";
import { requireRoles, AuthenticatedRequest } from "../middleware/auth";
import { verifyWebhookSignature } from "../middleware/hmac";

export const buildIngestionRouter = (
  wallet: WalletIngestor,
  cex: CexIngestor,
  bank: BankIngestor,
  autoIngest?: AutoIngestService
) => {
  const router = Router();

  const walletSchema = z.object({
    actorId: z.string(),
    period: z.string(),
    transfers: z.array(
      z.object({
        orgId: z.string(),
        walletId: z.string(),
        hash: z.string(),
        from: z.string(),
        to: z.string(),
        value: z.number(),
        tokenSymbol: z.string(),
        timestamp: z.string(),
        gasFee: z.number().optional()
      })
    )
  });

  router.post(
    "/wallet",
    verifyWebhookSignature,
    requireRoles(["poster", "admin"]),
    async (req, res) => {
      const parsed = walletSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json(parsed.error);
      try {
        const data = await wallet.ingest(parsed.data.transfers as WalletTransfer[], parsed.data.actorId, parsed.data.period);
        return res.json({ ingested: data.length });
      } catch (err: any) {
        return res.status(400).json({ error: err.message });
      }
    }
  );

  const cexSchema = z.object({
    actorId: z.string(),
    period: z.string(),
    trades: z.array(
      z.object({
        orgId: z.string(),
        tradeId: z.string(),
        baseSymbol: z.string(),
        quoteSymbol: z.string(),
        side: z.enum(["buy", "sell"]),
        quantity: z.number(),
        price: z.number(),
        fee: z.number(),
        timestamp: z.string()
      })
    )
  });

  router.post("/cex", requireRoles(["poster", "admin"]), async (req, res) => {
    const parsed = cexSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);
    try {
      const data = await cex.ingest(parsed.data.trades as CexTrade[], parsed.data.actorId, parsed.data.period);
      return res.json({ ingested: data.length });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  const bankSchema = z.object({
    actorId: z.string(),
    period: z.string(),
    txns: z.array(
      z.object({
        orgId: z.string(),
        externalId: z.string(),
        amount: z.number(),
        currency: z.string(),
        description: z.string(),
        timestamp: z.string()
      })
    )
  });

  router.post("/bank", requireRoles(["poster", "admin"]), (req, res) => {
    const parsed = bankSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);
    try {
      const data = bank.ingest(parsed.data.txns as BankTxn[], parsed.data.actorId, parsed.data.period);
      return res.json({ ingested: data.length });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // ============ BLOCKCHAIN AUTO-INGEST ============

  // Lookup a blockchain transaction (preview, no journal created)
  const lookupSchema = z.object({
    txHash: z.string().min(10)
  });

  router.post("/blockchain/lookup", requireRoles(["viewer", "poster", "admin"]), async (req, res) => {
    if (!autoIngest) {
      return res.status(501).json({ error: "Blockchain auto-ingest not configured" });
    }

    const parsed = lookupSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);

    try {
      const result = await autoIngest.lookupTransaction(parsed.data.txHash);
      return res.json(result);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // Detect chain from TX hash
  router.post("/blockchain/detect", requireRoles(["viewer", "poster", "admin"]), (req, res) => {
    const { txHash } = req.body;
    if (!txHash) return res.status(400).json({ error: "txHash required" });

    const chain = detectChain(txHash);
    return res.json({ chain, supported: chain !== null });
  });

  // Ingest a blockchain transaction and create journal entry
  const ingestBlockchainSchema = z.object({
    txHash: z.string().min(10),
    orgId: z.string(),
    period: z.string(),
    walletId: z.string().optional(),
    direction: z.enum(["inflow", "outflow", "auto"]).optional()
  });

  router.post("/blockchain/ingest", requireRoles(["poster", "admin"]), async (req: AuthenticatedRequest, res) => {
    if (!autoIngest) {
      return res.status(501).json({ error: "Blockchain auto-ingest not configured" });
    }

    const parsed = ingestBlockchainSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);

    try {
      // Check if already ingested
      const alreadyIngested = await autoIngest.isAlreadyIngested(parsed.data.orgId, parsed.data.txHash);
      if (alreadyIngested) {
        return res.status(409).json({ error: "Transaction already ingested" });
      }

      const result = await autoIngest.ingestTransaction(parsed.data.txHash, {
        orgId: parsed.data.orgId,
        actorId: req.user?.id || "unknown",
        period: parsed.data.period,
        walletId: parsed.data.walletId,
        direction: parsed.data.direction,
        createJournal: true
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      return res.json(result);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  return router;
};





