import { Router } from "express";
import { DepreciationService } from "../core/calculations/depreciation";

export const buildAssetsRouter = (depreciation: DepreciationService) => {
  const router = Router();

  // List assets
  router.get("/", async (req, res) => {
    try {
      const orgId = (req.query.orgId as string) || "demo-org";
      const assets = await depreciation.listAssets(orgId);
      res.json(assets);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Get single asset
  router.get("/:id", async (req, res) => {
    try {
      const asset = await depreciation.getAsset(req.params.id);
      if (!asset) return res.status(404).json({ error: "Not found" });
      res.json(asset);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Create asset
  router.post("/", async (req, res) => {
    try {
      const asset = await depreciation.addAsset(req.body);
      res.status(201).json(asset);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Get depreciation schedule for asset
  router.get("/:id/schedule", async (req, res) => {
    try {
      const schedule = await depreciation.getDepreciationSchedule(req.params.id);
      res.json(schedule);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Generate full schedule preview
  router.get("/:id/schedule/preview", async (req, res) => {
    try {
      const asset = await depreciation.getAsset(req.params.id);
      if (!asset) return res.status(404).json({ error: "Asset not found" });
      const schedule = depreciation.generateSchedule(asset);
      res.json(schedule);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Record monthly depreciation
  router.post("/:id/depreciate", async (req, res) => {
    try {
      const actorId = (req as any).user?.sub || "unknown";
      const { period } = req.body;
      const entry = await depreciation.recordMonthlyDepreciation(req.params.id, period, actorId);
      res.json(entry);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Asset register report
  router.get("/reports/register", async (req, res) => {
    try {
      const orgId = (req.query.orgId as string) || "demo-org";
      const register = await depreciation.assetRegister(orgId);
      res.json(register);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Depreciation summary for period
  router.get("/reports/depreciation/:period", async (req, res) => {
    try {
      const orgId = (req.query.orgId as string) || "demo-org";
      const summary = await depreciation.depreciationSummary(orgId, req.params.period);
      res.json(summary);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  return router;
};



