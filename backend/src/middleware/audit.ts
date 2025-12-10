import { Request, Response, NextFunction } from "express";
import { AuditLogService } from "../core/security/auditLog";

export const auditMiddleware =
  (audit: AuditLogService) => (req: Request, _res: Response, next: NextFunction) => {
    const actorId = (req as any).user?.id ?? "anonymous";
    audit.record({
      orgId: (req.headers["x-org-id"] as string) ?? "unknown",
      actorId,
      action: `http:${req.method.toLowerCase()}`,
      entity: "http",
      entityId: req.path,
      metadata: { query: req.query, body: req.body }
    });
    next();
  };



