import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { Role } from "../core/types";
import { RbacService } from "../core/security/rbac";

export interface AuthenticatedRequest extends Request {
  user?: { id: string; roles: Role[] };
}

export const authMiddleware =
  (rbac: RbacService) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const token = header.replace("Bearer ", "");
    try {
      const payload = jwt.verify(token, config.jwtSecret) as { sub: string; roles?: Role[] };
      const roles = payload.roles ?? [];
      req.user = { id: payload.sub, roles };
      next();
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }
  };

export const requireRoles =
  (roles: Role[]) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const ok = roles.some((r) => req.user?.roles.includes(r));
    if (!ok) return res.status(403).json({ error: "Forbidden" });
    next();
  };

