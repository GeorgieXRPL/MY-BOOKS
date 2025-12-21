import { Router } from "express";
import { requireRoles } from "../middleware/auth";
import { CloseService } from "../core/close";

export const buildCloseRouter = (close: CloseService) => {
  const router = Router();

  router.post("/seed", requireRoles(["admin", "approver"]), async (req, res) => {
    const { orgId, period } = req.body ?? {};
    if (!orgId || !period) return res.status(400).json({ error: "orgId and period required" });
    const result = await close.seed(orgId, period);
    return res.json(result);
  });

  router.get("/", requireRoles(["viewer", "admin", "auditor"]), async (req, res) => {
    const { orgId, period } = req.query;
    if (!orgId || !period || typeof orgId !== "string" || typeof period !== "string") {
      return res.status(400).json({ error: "orgId and period required" });
    }
    const result = await close.list(orgId, period);
    return res.json(result);
  });

  router.post("/:id/complete", requireRoles(["approver", "admin"]), async (req, res) => {
    const actor = (req as any).user?.id ?? "unknown";
    try {
      const result = await close.complete(req.params.id, actor);
      return res.json(result);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  return router;
};





