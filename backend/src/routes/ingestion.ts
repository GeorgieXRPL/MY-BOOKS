import { Router } from "express";
import { z } from "zod";
import { WalletIngestor, WalletTransfer } from "../core/ingestion/wallet";
import { CexIngestor, CexTrade } from "../core/ingestion/cex";
import { BankIngestor, BankTxn } from "../core/ingestion/bank";
import { requireRoles } from "../middleware/auth";
import { verifyWebhookSignature } from "../middleware/hmac";

export const buildIngestionRouter = (
  wallet: WalletIngestor,
  cex: CexIngestor,
  bank: BankIngestor
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

  return router;
};





