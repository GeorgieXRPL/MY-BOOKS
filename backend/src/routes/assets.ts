import { Router } from "express";
import { DepreciationService } from "../core/calculations/depreciation";

export const buildAssetsRouter = (depreciation: DepreciationService) => {
  const router = Router();

  // List assets
  router.get("/", (req, res) => {
    try {
      const orgId = (req.query.orgId as string) || "demo-org";
      const assets = depreciation.listAssets(orgId);
      res.json(assets);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Get single asset
  router.get("/:id", (req, res) => {
    try {
      const asset = depreciation.getAsset(req.params.id);
      if (!asset) return res.status(404).json({ error: "Not found" });
      res.json(asset);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Create asset
  router.post("/", (req, res) => {
    try {
      const asset = depreciation.addAsset(req.body);
      res.status(201).json(asset);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Get depreciation schedule for asset
  router.get("/:id/schedule", (req, res) => {
    try {
      const schedule = depreciation.getDepreciationSchedule(req.params.id);
      res.json(schedule);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Generate full schedule preview
  router.get("/:id/schedule/preview", (req, res) => {
    try {
      const asset = depreciation.getAsset(req.params.id);
      if (!asset) return res.status(404).json({ error: "Asset not found" });
      const schedule = depreciation.generateSchedule(asset);
      res.json(schedule);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Record monthly depreciation
  router.post("/:id/depreciate", (req, res) => {
    try {
      const actorId = (req as any).user?.sub || "unknown";
      const { period } = req.body;
      const entry = depreciation.recordMonthlyDepreciation(req.params.id, period, actorId);
      res.json(entry);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Asset register report
  router.get("/reports/register", (req, res) => {
    try {
      const orgId = (req.query.orgId as string) || "demo-org";
      const register = depreciation.assetRegister(orgId);
      res.json(register);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Depreciation summary for period
  router.get("/reports/depreciation/:period", (req, res) => {
    try {
      const orgId = (req.query.orgId as string) || "demo-org";
      const summary = depreciation.depreciationSummary(orgId, req.params.period);
      res.json(summary);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  return router;
};

