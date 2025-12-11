import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { DbStore } from "./store.db";
import { config } from "../config";
import { newId } from "../utils/id";
import { Role } from "./types";

const SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = "15m"; // Short-lived access token
const REFRESH_TOKEN_EXPIRY_DAYS = 30;

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  orgId: string;
  roles: Role[];
  isActive: boolean;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
}

export class AuthService {
  constructor(private store: DbStore, private defaultOrgId: string) {}

  async register(email: string, password: string, name?: string): Promise<{ user: AuthUser; tokens: TokenPair }> {
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user exists
    const existing = this.store.getUserByEmail(normalizedEmail);
    if (existing) {
      throw new Error("Email already registered");
    }

    // Check for pending invitation (determines org & roles)
    // For now, default to the main org with viewer role
    // In production, you'd require an invitation or create a new org
    const invitation = this.store.getInvitationByEmail(normalizedEmail, this.defaultOrgId);
    
    const userId = newId();
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const roles: Role[] = invitation?.roles || ["viewer"];
    const orgId = invitation?.orgId || this.defaultOrgId;

    this.store.createUser({
      id: userId,
      email: normalizedEmail,
      passwordHash,
      name,
      orgId,
      roles
    });

    if (invitation) {
      this.store.acceptInvitation(invitation.id);
    }

    const user = this.store.getUserById(userId);
    if (!user) throw new Error("Failed to create user");

    const tokens = this.generateTokens(user);

    return {
      user: this.sanitizeUser(user),
      tokens
    };
  }

  async login(email: string, password: string): Promise<{ user: AuthUser; tokens: TokenPair }> {
    const normalizedEmail = email.toLowerCase().trim();

    const user = this.store.getUserByEmail(normalizedEmail);
    if (!user) {
      throw new Error("Invalid email or password");
    }

    if (!user.isActive) {
      throw new Error("Account is disabled");
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new Error("Invalid email or password");
    }

    this.store.updateUserLastLogin(user.id);
    const tokens = this.generateTokens(user);

    return {
      user: this.sanitizeUser(user),
      tokens
    };
  }

  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    const tokenRecord = this.store.getRefreshToken(refreshToken);
    if (!tokenRecord) {
      throw new Error("Invalid refresh token");
    }

    if (new Date(tokenRecord.expiresAt) < new Date()) {
      this.store.revokeRefreshToken(refreshToken);
      throw new Error("Refresh token expired");
    }

    const user = this.store.getUserById(tokenRecord.userId);
    if (!user || !user.isActive) {
      throw new Error("User not found or disabled");
    }

    // Revoke old refresh token (rotation)
    this.store.revokeRefreshToken(refreshToken);

    return this.generateTokens(user);
  }

  logout(refreshToken: string): void {
    this.store.revokeRefreshToken(refreshToken);
  }

  logoutAll(userId: string): void {
    this.store.revokeAllUserTokens(userId);
  }

  getUser(userId: string): AuthUser | undefined {
    const user = this.store.getUserById(userId);
    if (!user) return undefined;
    return this.sanitizeUser(user);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = this.store.getUserById(userId);
    if (!user) throw new Error("User not found");

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new Error("Current password is incorrect");

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    this.store.db.prepare("UPDATE users SET passwordHash = ?, updatedAt = ? WHERE id = ?")
      .run(passwordHash, new Date().toISOString(), userId);

    // Revoke all refresh tokens after password change
    this.store.revokeAllUserTokens(userId);
  }

  // Admin: invite a user to the org
  inviteUser(inviterUserId: string, email: string, roles: Role[]): { id: string; email: string; expiresAt: Date } {
    const inviter = this.store.getUserById(inviterUserId);
    if (!inviter || !inviter.roles.includes("admin")) {
      throw new Error("Only admins can invite users");
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = this.store.getUserByEmail(normalizedEmail);
    if (existing && existing.orgId === inviter.orgId) {
      throw new Error("User already in organization");
    }

    const invite = {
      id: newId(),
      orgId: inviter.orgId,
      email: normalizedEmail,
      roles,
      invitedBy: inviterUserId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    };

    this.store.createInvitation(invite);
    return { id: invite.id, email: normalizedEmail, expiresAt: invite.expiresAt };
  }

  // Admin: list team members
  listTeamMembers(userId: string) {
    const user = this.store.getUserById(userId);
    if (!user) throw new Error("User not found");
    return this.store.listUsersByOrg(user.orgId);
  }

  // Admin: update user roles
  updateUserRoles(adminUserId: string, targetUserId: string, roles: Role[]): AuthUser {
    const admin = this.store.getUserById(adminUserId);
    if (!admin || !admin.roles.includes("admin")) {
      throw new Error("Only admins can update roles");
    }

    const target = this.store.getUserById(targetUserId);
    if (!target || target.orgId !== admin.orgId) {
      throw new Error("User not found in organization");
    }

    const updated = this.store.updateUser(targetUserId, { roles });
    return this.sanitizeUser(updated);
  }

  // Admin: disable user
  disableUser(adminUserId: string, targetUserId: string): void {
    const admin = this.store.getUserById(adminUserId);
    if (!admin || !admin.roles.includes("admin")) {
      throw new Error("Only admins can disable users");
    }

    if (adminUserId === targetUserId) {
      throw new Error("Cannot disable yourself");
    }

    const target = this.store.getUserById(targetUserId);
    if (!target || target.orgId !== admin.orgId) {
      throw new Error("User not found in organization");
    }

    this.store.updateUser(targetUserId, { isActive: false });
    this.store.revokeAllUserTokens(targetUserId);
  }

  private generateTokens(user: any): TokenPair {
    // Access token
    const accessToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        orgId: user.orgId,
        roles: user.roles
      },
      config.jwtSecret,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    // Refresh token (random, stored in DB)
    const refreshToken = crypto.randomBytes(64).toString("hex");
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    this.store.createRefreshToken(user.id, refreshToken, expiresAt);

    return {
      accessToken,
      refreshToken,
      expiresIn: 900 // 15 minutes in seconds
    };
  }

  private sanitizeUser(user: any): AuthUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      orgId: user.orgId,
      roles: user.roles,
      isActive: user.isActive
    };
  }
}



