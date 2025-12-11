import { Router } from "express";
import { InvoiceService } from "../core/invoices";
import { DbStore } from "../core/store.db";
import { newId } from "../utils/id";

export const buildInvoicesRouter = (invoices: InvoiceService, store: DbStore) => {
  const router = Router();

  // List invoices
  router.get("/", (req, res) => {
    try {
      const orgId = (req.query.orgId as string) || "demo-org";
      const type = req.query.type as "receivable" | "payable" | undefined;
      const status = req.query.status as any;
      const list = invoices.list(orgId, { type, status });
      res.json(list);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Get single invoice
  router.get("/:id", (req, res) => {
    try {
      const invoice = invoices.get(req.params.id);
      if (!invoice) return res.status(404).json({ error: "Not found" });
      res.json(invoice);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Create invoice
  router.post("/", (req, res) => {
    try {
      const actorId = (req as any).user?.sub || "unknown";
      const invoice = invoices.create({
        ...req.body,
        createdBy: actorId
      });
      res.status(201).json(invoice);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Update status
  router.patch("/:id/status", (req, res) => {
    try {
      const actorId = (req as any).user?.sub || "unknown";
      const { status } = req.body;
      const invoice = invoices.updateStatus(req.params.id, status, actorId);
      res.json(invoice);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Mark paid
  router.post("/:id/pay", (req, res) => {
    try {
      const actorId = (req as any).user?.sub || "unknown";
      const { paidAmount } = req.body;
      const invoice = invoices.markPaid(req.params.id, paidAmount, actorId);
      res.json(invoice);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Aging report
  router.get("/reports/aging", (req, res) => {
    try {
      const orgId = (req.query.orgId as string) || "demo-org";
      const type = (req.query.type as "receivable" | "payable") || "receivable";
      const report = invoices.agingReport(orgId, type);
      res.json(report);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Counterparties
  router.get("/counterparties", (req, res) => {
    try {
      const orgId = (req.query.orgId as string) || "demo-org";
      res.json(store.listCounterparties(orgId));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  router.post("/counterparties", (req, res) => {
    try {
      const cp = store.addCounterparty({
        ...req.body,
        id: newId(),
        createdAt: new Date().toISOString()
      });
      res.status(201).json(cp);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  return router;
};



