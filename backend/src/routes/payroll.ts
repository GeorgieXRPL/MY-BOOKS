import { Router } from "express";
import { PayrollService } from "../core/payroll";

export const buildPayrollRouter = (payroll: PayrollService) => {
  const router = Router();

  // ============ EMPLOYEES ============
  router.get("/employees", (req, res) => {
    try {
      const orgId = (req.query.orgId as string) || "demo-org";
      res.json(payroll.listEmployees(orgId));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  router.get("/employees/:id", (req, res) => {
    try {
      const employee = payroll.getEmployee(req.params.id);
      if (!employee) return res.status(404).json({ error: "Not found" });
      res.json(employee);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  router.post("/employees", (req, res) => {
    try {
      const employee = payroll.addEmployee(req.body);
      res.status(201).json(employee);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ============ PAYROLL RUNS ============
  router.get("/runs", (req, res) => {
    try {
      const orgId = (req.query.orgId as string) || "demo-org";
      res.json(payroll.list(orgId));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  router.get("/runs/:id", (req, res) => {
    try {
      const run = payroll.get(req.params.id);
      if (!run) return res.status(404).json({ error: "Not found" });
      res.json(run);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  router.post("/runs", (req, res) => {
    try {
      const actorId = (req as any).user?.sub || "unknown";
      const run = payroll.createRun({
        ...req.body,
        createdBy: actorId
      });
      res.status(201).json(run);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  router.post("/runs/:id/calculate", (req, res) => {
    try {
      const actorId = (req as any).user?.sub || "unknown";
      const { taxRate } = req.body;
      const run = payroll.calculateTaxes(req.params.id, taxRate || 20, actorId);
      res.json(run);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  router.post("/runs/:id/approve", (req, res) => {
    try {
      const actorId = (req as any).user?.sub || "unknown";
      const run = payroll.approve(req.params.id, actorId);
      res.json(run);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  router.post("/runs/:id/finalize", (req, res) => {
    try {
      const actorId = (req as any).user?.sub || "unknown";
      const run = payroll.finalize(req.params.id, actorId);
      res.json(run);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Summary
  router.get("/summary/:year", (req, res) => {
    try {
      const orgId = (req.query.orgId as string) || "demo-org";
      const summary = payroll.summary(orgId, req.params.year);
      res.json(summary);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  return router;
};



