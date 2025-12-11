import { Router } from "express";
import { TaxService } from "../core/calculations/tax";
import { RatioService } from "../core/calculations/ratios";
import { FormulaService } from "../core/calculations/formulas";
import { FXService } from "../core/calculations/fx";

export const buildCalculationsRouter = (
  tax: TaxService,
  ratios: RatioService,
  formulas: FormulaService,
  fx: FXService
) => {
  const router = Router();

  // ============ TAX RATES ============
  router.get("/tax/rates", (req, res) => {
    try {
      const orgId = (req.query.orgId as string) || "demo-org";
      res.json(tax.listTaxRates(orgId));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  router.post("/tax/rates", (req, res) => {
    try {
      const rate = tax.addTaxRate(req.body);
      res.status(201).json(rate);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Tax calculation
  router.post("/tax/calculate", (req, res) => {
    try {
      const { amount, rate, inclusive } = req.body;
      const result = inclusive
        ? tax.calculateTaxInclusive(amount, rate)
        : tax.calculateTax(amount, rate);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Sales tax summary
  router.get("/tax/sales-summary", (req, res) => {
    try {
      const orgId = (req.query.orgId as string) || "demo-org";
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      const summary = tax.salesTaxSummary(orgId, startDate, endDate);
      res.json(summary);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Payroll tax summary
  router.get("/tax/payroll-summary/:year", (req, res) => {
    try {
      const orgId = (req.query.orgId as string) || "demo-org";
      const summary = tax.payrollTaxSummary(orgId, req.params.year);
      res.json(summary);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // BAS preview
  router.get("/tax/bas/:quarter", (req, res) => {
    try {
      const orgId = (req.query.orgId as string) || "demo-org";
      const preview = tax.basPreview(orgId, req.params.quarter);
      res.json(preview);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Income tax provision
  router.get("/tax/income-provision/:year", (req, res) => {
    try {
      const orgId = (req.query.orgId as string) || "demo-org";
      const taxRate = parseFloat((req.query.taxRate as string) || "30");
      const provision = tax.incomeTaxProvision(orgId, req.params.year, taxRate);
      res.json(provision);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ============ RATIOS ============
  router.get("/ratios", (req, res) => {
    try {
      const orgId = (req.query.orgId as string) || "demo-org";
      const period = req.query.period as string | undefined;
      const all = ratios.allRatios(orgId, period);
      res.json(all);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  router.get("/ratios/dashboard", (req, res) => {
    try {
      const orgId = (req.query.orgId as string) || "demo-org";
      const period = req.query.period as string | undefined;
      const dashboard = ratios.dashboard(orgId, period);
      res.json(dashboard);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  router.post("/ratios/trend", (req, res) => {
    try {
      const { orgId, periods } = req.body;
      const trend = ratios.trend(orgId || "demo-org", periods || []);
      res.json(trend);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ============ FORMULAS ============
  router.get("/formulas", (req, res) => {
    try {
      const orgId = (req.query.orgId as string) || "demo-org";
      const category = req.query.category as string | undefined;
      res.json(formulas.list(orgId, category));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  router.get("/formulas/presets", (_req, res) => {
    try {
      res.json(formulas.getPresetFormulas());
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  router.post("/formulas/seed-presets", (req, res) => {
    try {
      const orgId = (req.body.orgId as string) || "demo-org";
      const actorId = (req as any).user?.sub || "unknown";
      const created = formulas.seedPresets(orgId, actorId);
      res.json({ seeded: created.length, formulas: created });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  router.get("/formulas/:id", (req, res) => {
    try {
      const formula = formulas.get(req.params.id);
      if (!formula) return res.status(404).json({ error: "Not found" });
      res.json(formula);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  router.post("/formulas", (req, res) => {
    try {
      const actorId = (req as any).user?.sub || "unknown";
      const formula = formulas.create({
        ...req.body,
        createdBy: actorId
      });
      res.status(201).json(formula);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  router.post("/formulas/:id/evaluate", (req, res) => {
    try {
      const { context } = req.body;
      const result = formulas.evaluate(req.params.id, context || {});
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  router.post("/formulas/:id/evaluate-auto", (req, res) => {
    try {
      const { orgId, period, additionalContext } = req.body;
      const result = formulas.evaluateWithAutoContext(
        req.params.id,
        orgId || "demo-org",
        period,
        additionalContext
      );
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  router.get("/formulas/evaluate-all", (req, res) => {
    try {
      const orgId = (req.query.orgId as string) || "demo-org";
      const period = req.query.period as string | undefined;
      const results = formulas.evaluateAll(orgId, period);
      res.json(results);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ============ FX ============
  router.get("/fx/exposure", (req, res) => {
    try {
      const orgId = (req.query.orgId as string) || "demo-org";
      const report = fx.exposureReport(orgId);
      res.json(report);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  router.post("/fx/convert", (req, res) => {
    try {
      const { amount, fromCurrency, toCurrency, rate } = req.body;
      const result = fx.convert(amount, fromCurrency, toCurrency, rate);
      res.json({ amount, fromCurrency, toCurrency, result });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  router.post("/fx/record-rate", (req, res) => {
    try {
      const { base, quote, rate, source } = req.body;
      const fxRate = fx.recordRate(base, quote, rate, source || "manual");
      res.json(fxRate);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  router.post("/fx/gain-loss", (req, res) => {
    try {
      const { currency, originalAmount, originalRate, currentRate } = req.body;
      const result = fx.calculateUnrealizedGainLoss(currency, originalAmount, originalRate, currentRate);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  return router;
};



