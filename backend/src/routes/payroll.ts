import { Router } from "express";
import { PayrollService } from "../core/payroll";

export const buildPayrollRouter = (payroll: PayrollService) => {
  const router = Router();

  // ============ EMPLOYEES ============
  router.get("/employees", async (req, res) => {
    try {
      const orgId = (req.query.orgId as string) || "demo-org";
      const list = await payroll.listEmployees(orgId);
      res.json(list);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  router.get("/employees/:id", async (req, res) => {
    try {
      const employee = await payroll.getEmployee(req.params.id);
      if (!employee) return res.status(404).json({ error: "Not found" });
      res.json(employee);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  router.post("/employees", async (req, res) => {
    try {
      const employee = await payroll.addEmployee(req.body);
      res.status(201).json(employee);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ============ PAYROLL RUNS ============
  router.get("/runs", async (req, res) => {
    try {
      const orgId = (req.query.orgId as string) || "demo-org";
      const list = await payroll.list(orgId);
      res.json(list);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  router.get("/runs/:id", async (req, res) => {
    try {
      const run = await payroll.get(req.params.id);
      if (!run) return res.status(404).json({ error: "Not found" });
      res.json(run);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  router.post("/runs", async (req, res) => {
    try {
      const actorId = (req as any).user?.sub || "unknown";
      const run = await payroll.createRun({
        ...req.body,
        createdBy: actorId
      });
      res.status(201).json(run);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  router.post("/runs/:id/calculate", async (req, res) => {
    try {
      const actorId = (req as any).user?.sub || "unknown";
      const { taxRate } = req.body;
      const run = await payroll.calculateTaxes(req.params.id, taxRate || 20, actorId);
      res.json(run);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  router.post("/runs/:id/approve", async (req, res) => {
    try {
      const actorId = (req as any).user?.sub || "unknown";
      const run = await payroll.approve(req.params.id, actorId);
      res.json(run);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  router.post("/runs/:id/finalize", async (req, res) => {
    try {
      const actorId = (req as any).user?.sub || "unknown";
      const run = await payroll.finalize(req.params.id, actorId);
      res.json(run);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Summary
  router.get("/summary/:year", async (req, res) => {
    try {
      const orgId = (req.query.orgId as string) || "demo-org";
      const summary = await payroll.summary(orgId, req.params.year);
      res.json(summary);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  return router;
};



