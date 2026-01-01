/**
 * Admin Impersonation Service
 * Allows admins to impersonate users for debugging
 */

import jwt from "jsonwebtoken";
import { config } from "../config";
import { logger } from "../utils/logger";

interface ImpersonationToken {
  originalAdminId: string;
  impersonatedUserId: string;
  impersonatedOrgId: string;
  reason: string;
  expiresAt: Date;
}

// Active impersonation sessions
const activeSessions: Map<string, ImpersonationToken> = new Map();

/**
 * Create an impersonation token
 */
export function createImpersonationToken(
  adminId: string,
  targetUser: {
    id: string;
    email: string;
    orgId: string;
    roles: string[];
    name?: string;
  },
  reason: string,
  durationMinutes = 30
): string {
  const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

  // Create JWT with impersonation flag
  const payload = {
    sub: targetUser.id,
    email: targetUser.email,
    orgId: targetUser.orgId,
    roles: targetUser.roles,
    name: targetUser.name,
    // Impersonation metadata
    isImpersonated: true,
    impersonatedBy: adminId,
    impersonationReason: reason
  };

  const token = jwt.sign(payload, config.jwtSecret, {
    expiresIn: `${durationMinutes}m`
  });

  // Track active session
  activeSessions.set(token, {
    originalAdminId: adminId,
    impersonatedUserId: targetUser.id,
    impersonatedOrgId: targetUser.orgId,
    reason,
    expiresAt
  });

  logger.warn("Impersonation started", {
    adminId,
    targetUserId: targetUser.id,
    targetEmail: targetUser.email,
    reason,
    expiresAt
  });

  return token;
}

/**
 * End an impersonation session
 */
export function endImpersonation(token: string): boolean {
  const session = activeSessions.get(token);
  if (session) {
    logger.info("Impersonation ended", {
      adminId: session.originalAdminId,
      targetUserId: session.impersonatedUserId
    });
    activeSessions.delete(token);
    return true;
  }
  return false;
}

/**
 * Check if a token is an impersonation token
 */
export function isImpersonationToken(decoded: any): boolean {
  return decoded?.isImpersonated === true;
}

/**
 * Get all active impersonation sessions
 */
export function getActiveSessions(): Array<{
  adminId: string;
  targetUserId: string;
  targetOrgId: string;
  reason: string;
  expiresAt: string;
}> {
  const now = Date.now();
  const results: Array<{
    adminId: string;
    targetUserId: string;
    targetOrgId: string;
    reason: string;
    expiresAt: string;
  }> = [];

  for (const [token, session] of activeSessions) {
    if (session.expiresAt.getTime() > now) {
      results.push({
        adminId: session.originalAdminId,
        targetUserId: session.impersonatedUserId,
        targetOrgId: session.impersonatedOrgId,
        reason: session.reason,
        expiresAt: session.expiresAt.toISOString()
      });
    } else {
      // Clean up expired session
      activeSessions.delete(token);
    }
  }

  return results;
}

/**
 * Clean up expired sessions
 */
export function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of activeSessions) {
    if (session.expiresAt.getTime() <= now) {
      activeSessions.delete(token);
    }
  }
}


