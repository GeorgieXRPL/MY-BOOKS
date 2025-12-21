import { Router } from "express";
import { ExpenseService } from "../core/expenses";

export const buildExpensesRouter = (expenses: ExpenseService) => {
  const router = Router();

  // List expenses
  router.get("/", async (req, res) => {
    try {
      const orgId = (req.query.orgId as string) || "demo-org";
      const status = req.query.status as any;
      const category = req.query.category as string | undefined;
      const list = await expenses.list(orgId, { status, category });
      res.json(list);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Get single expense
  router.get("/:id", async (req, res) => {
    try {
      const expense = await expenses.get(req.params.id);
      if (!expense) return res.status(404).json({ error: "Not found" });
      res.json(expense);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Create expense
  router.post("/", async (req, res) => {
    try {
      const actorId = (req as any).user?.sub || "unknown";
      const expense = await expenses.create({
        ...req.body,
        createdBy: actorId
      });
      res.status(201).json(expense);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Submit for approval
  router.post("/:id/submit", async (req, res) => {
    try {
      const actorId = (req as any).user?.sub || "unknown";
      const expense = await expenses.submit(req.params.id, actorId);
      res.json(expense);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Approve
  router.post("/:id/approve", async (req, res) => {
    try {
      const actorId = (req as any).user?.sub || "unknown";
      const expense = await expenses.approve(req.params.id, actorId);
      res.json(expense);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Reject
  router.post("/:id/reject", async (req, res) => {
    try {
      const actorId = (req as any).user?.sub || "unknown";
      const expense = await expenses.reject(req.params.id, actorId);
      res.json(expense);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Mark paid
  router.post("/:id/pay", async (req, res) => {
    try {
      const actorId = (req as any).user?.sub || "unknown";
      const expense = await expenses.markPaid(req.params.id, actorId);
      res.json(expense);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Category breakdown report
  router.get("/reports/categories", async (req, res) => {
    try {
      const orgId = (req.query.orgId as string) || "demo-org";
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const breakdown = await expenses.categoryBreakdown(orgId, startDate, endDate);
      res.json(breakdown);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  return router;
};



