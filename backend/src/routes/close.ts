import { Router } from "express";
import { requireRoles } from "../middleware/auth";
import { CloseService } from "../core/close";

export const buildCloseRouter = (close: CloseService) => {
  const router = Router();

  router.post("/seed", requireRoles(["admin", "approver"]), (req, res) => {
    const { orgId, period } = req.body ?? {};
    if (!orgId || !period) return res.status(400).json({ error: "orgId and period required" });
    return res.json(close.seed(orgId, period));
  });

  router.get("/", requireRoles(["viewer", "admin", "auditor"]), (req, res) => {
    const { orgId, period } = req.query;
    if (!orgId || !period || typeof orgId !== "string" || typeof period !== "string") {
      return res.status(400).json({ error: "orgId and period required" });
    }
    return res.json(close.list(orgId, period));
  });

  router.post("/:id/complete", requireRoles(["approver", "admin"]), (req, res) => {
    const actor = (req as any).user?.id ?? "unknown";
    try {
      return res.json(close.complete(req.params.id, actor));
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  return router;
};





