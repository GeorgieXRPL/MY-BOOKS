import { Router } from "express";
import { z } from "zod";
import { AuthService } from "../core/auth";
import { RbacService } from "../core/security/rbac";
import { MfaService } from "../core/security/mfa";
import { AuditLogService } from "../core/security/auditLog";
import { ControlsService } from "../core/controls";
import { requireRoles, AuthenticatedRequest } from "../middleware/auth";
import { authRateLimit } from "../middleware/security";
import { Role } from "../core/types";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

const inviteSchema = z.object({
  email: z.string().email(),
  roles: z.array(z.enum(["admin", "poster", "approver", "viewer", "auditor"]))
});

export const buildSecurityRouter = (
  auth: AuthService,
  rbac: RbacService,
  mfa: MfaService,
  audit: AuditLogService,
  controls: ControlsService
) => {
  const router = Router();

  // ============ PUBLIC AUTH ROUTES ============
  // Apply stricter rate limiting to auth endpoints
  router.use("/auth", authRateLimit);

  // Register a new user
  router.post("/auth/register", async (req, res) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0].message });
      }

      const { email, password, name } = parsed.data;
      const result = await auth.register(email, password, name);

      return res.status(201).json({
        user: result.user,
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        expiresIn: result.tokens.expiresIn
      });
    } catch (err: any) {
      if (err.message === "Email already registered") {
        return res.status(409).json({ error: err.message });
      }
      return res.status(500).json({ error: "Registration failed" });
    }
  });

  // Login
  router.post("/auth/login", async (req, res) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid email or password format" });
      }

      const { email, password } = parsed.data;
      const result = await auth.login(email, password);

      return res.json({
        user: result.user,
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        expiresIn: result.tokens.expiresIn
      });
    } catch (err: any) {
      if (err.message === "Invalid email or password" || err.message === "Account is disabled") {
        return res.status(401).json({ error: err.message });
      }
      return res.status(500).json({ error: "Login failed" });
    }
  });

  // Refresh tokens
  router.post("/auth/refresh", async (req, res) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return res.status(400).json({ error: "Refresh token required" });
      }

      const tokens = await auth.refreshTokens(refreshToken);

      return res.json({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn
      });
    } catch (err: any) {
      return res.status(401).json({ error: err.message || "Invalid refresh token" });
    }
  });

  // Logout
  router.post("/auth/logout", (req, res) => {
    const { refreshToken } = req.body;
    if (refreshToken) {
      auth.logout(refreshToken);
    }
    return res.json({ ok: true });
  });

  // ============ AUTHENTICATED ROUTES ============

  // Get current user profile
  router.get("/auth/me", requireRoles([]), (req: AuthenticatedRequest, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const user = auth.getUser(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json(user);
  });

  // Change password
  router.post("/auth/change-password", requireRoles([]), async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Current and new password required" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ error: "New password must be at least 8 characters" });
      }

      await auth.changePassword(req.user.id, currentPassword, newPassword);
      return res.json({ ok: true, message: "Password changed. Please login again." });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // Logout from all devices
  router.post("/auth/logout-all", requireRoles([]), (req: AuthenticatedRequest, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    auth.logoutAll(req.user.id);
    return res.json({ ok: true, message: "Logged out from all devices" });
  });

  // ============ ADMIN: TEAM MANAGEMENT ============

  // List team members
  router.get("/team", requireRoles(["admin"]), (req: AuthenticatedRequest, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const members = auth.listTeamMembers(req.user.id);
    return res.json(members);
  });

  // Invite user to team
  router.post("/team/invite", requireRoles(["admin"]), (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });

      const parsed = inviteSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0].message });
      }

      const invite = auth.inviteUser(req.user.id, parsed.data.email, parsed.data.roles as Role[]);
      return res.json(invite);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // Update user roles
  router.patch("/team/:userId/roles", requireRoles(["admin"]), (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const { roles } = req.body;
      if (!Array.isArray(roles)) {
        return res.status(400).json({ error: "Roles must be an array" });
      }

      const updated = auth.updateUserRoles(req.user.id, req.params.userId, roles);
      return res.json(updated);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // Disable user
  router.post("/team/:userId/disable", requireRoles(["admin"]), (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      auth.disableUser(req.user.id, req.params.userId);
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // ============ EXISTING RBAC/CONTROLS ROUTES ============

  // RBAC role assignment (admin only)
  router.post("/roles", requireRoles(["admin"]), (req, res) => {
    const { userId, roles } = req.body ?? {};
    if (!userId || !Array.isArray(roles)) return res.status(400).json({ error: "userId and roles required" });
    const assignment = rbac.assign(userId, roles);
    return res.json(assignment);
  });

  // Audit log (auditor/admin)
  router.get("/audit-log", requireRoles(["auditor", "admin"]), (req, res) => {
    const orgId = req.query.orgId as string;
    if (!orgId) return res.status(400).json({ error: "orgId required" });
    return res.json(audit.list(orgId));
  });

  // MFA secret (authenticated)
  router.post("/mfa/secret", requireRoles([]), (req, res) => {
    return res.json({ secret: mfa.generateSecret() });
  });

  // Treasury policy (admin)
  router.post("/policy", requireRoles(["admin"]), (req, res) => {
    const { orgId, maxSingleSpend, largeTxAlertThreshold, minSignerQuorum } = req.body ?? {};
    if (!orgId) return res.status(400).json({ error: "orgId required" });
    const policy = controls.setPolicy(orgId, {
      maxSingleSpend: Number(maxSingleSpend ?? 0),
      largeTxAlertThreshold: Number(largeTxAlertThreshold ?? 0),
      minSignerQuorum: Number(minSignerQuorum ?? 0)
    });
    return res.json(policy);
  });

  return router;
};
