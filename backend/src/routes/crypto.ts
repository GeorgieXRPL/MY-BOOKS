import { Router } from "express";
import { CryptoService } from "../core/crypto";

export const buildCryptoRouter = (crypto: CryptoService) => {
  const router = Router();

  // List transactions
  router.get("/transactions", (req, res) => {
    try {
      const orgId = (req.query.orgId as string) || "demo-org";
      const tokenSymbol = req.query.tokenSymbol as string | undefined;
      const list = crypto.listTransactions(orgId, tokenSymbol);
      res.json(list);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Record transaction
  router.post("/transactions", (req, res) => {
    try {
      const txn = crypto.recordTransaction(req.body);
      res.status(201).json(txn);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // List lots
  router.get("/lots", (req, res) => {
    try {
      const orgId = (req.query.orgId as string) || "demo-org";
      const tokenSymbol = req.query.tokenSymbol as string | undefined;
      const lots = crypto.listLots(orgId, tokenSymbol);
      res.json(lots);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Holdings
  router.get("/holdings", (req, res) => {
    try {
      const orgId = (req.query.orgId as string) || "demo-org";
      const holdings = crypto.holdings(orgId);
      res.json(holdings);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Calculate realized gain on disposal
  router.post("/calculate-gain", (req, res) => {
    try {
      const { orgId, tokenSymbol, disposalQty, disposalPriceUsd, method } = req.body;
      const result = crypto.calculateRealizedGain(
        orgId || "demo-org",
        tokenSymbol,
        disposalQty,
        disposalPriceUsd,
        method || "fifo"
      );
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Unrealized gains
  router.post("/unrealized-gains", (req, res) => {
    try {
      const { orgId, currentPrices } = req.body;
      const result = crypto.unrealizedGains(orgId || "demo-org", currentPrices || {});
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Cost basis report
  router.get("/reports/cost-basis", (req, res) => {
    try {
      const orgId = (req.query.orgId as string) || "demo-org";
      const report = crypto.costBasisReport(orgId);
      res.json(report);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  return router;
};



