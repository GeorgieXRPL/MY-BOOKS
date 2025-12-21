import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
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

// Store interface that works with both sync (DbStore) and async (PgStore)
interface AuthStore {
  getUserByEmail(email: string): any | Promise<any>;
  getUserById(id: string): any | Promise<any>;
  getInvitationByEmail(email: string, orgId: string): any | Promise<any>;
  createUser(user: any): any | Promise<any>;
  acceptInvitation(id: string): any | Promise<any>;
  createRefreshToken(userId: string, token: string, expiresAt: Date): any | Promise<any>;
  getRefreshToken(token: string): any | Promise<any>;
  revokeRefreshToken(token: string): any | Promise<any>;
  revokeAllUserTokens(userId: string): any | Promise<any>;
  updateUserLastLogin(userId: string): any | Promise<any>;
  updateUser(userId: string, updates: any): any | Promise<any>;
  createInvitation(invite: any): any | Promise<any>;
  listUsersByOrg(orgId: string): any | Promise<any>;
}

export class AuthService {
  constructor(private store: AuthStore, private defaultOrgId: string) {}

  async register(email: string, password: string, name?: string): Promise<{ user: AuthUser; tokens: TokenPair }> {
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user exists (await for async stores)
    const existing = await Promise.resolve(this.store.getUserByEmail(normalizedEmail));
    if (existing) {
      throw new Error("Email already registered");
    }

    // Check for pending invitation (determines org & roles)
    const invitation = await Promise.resolve(this.store.getInvitationByEmail(normalizedEmail, this.defaultOrgId));
    
    const userId = newId();
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const roles: Role[] = invitation?.roles || ["admin"]; // First user gets admin role
    const orgId = invitation?.orgId || this.defaultOrgId;

    await Promise.resolve(this.store.createUser({
      id: userId,
      email: normalizedEmail,
      passwordHash,
      name,
      orgId,
      roles
    }));

    if (invitation) {
      await Promise.resolve(this.store.acceptInvitation(invitation.id));
    }

    const user = await Promise.resolve(this.store.getUserById(userId));
    if (!user) throw new Error("Failed to create user");

    const tokens = await this.generateTokens(user);

    return {
      user: this.sanitizeUser(user),
      tokens
    };
  }

  async login(email: string, password: string): Promise<{ user: AuthUser; tokens: TokenPair }> {
    const normalizedEmail = email.toLowerCase().trim();

    const user = await Promise.resolve(this.store.getUserByEmail(normalizedEmail));
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

    await Promise.resolve(this.store.updateUserLastLogin(user.id));
    const tokens = await this.generateTokens(user);

    return {
      user: this.sanitizeUser(user),
      tokens
    };
  }

  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    const tokenRecord = await Promise.resolve(this.store.getRefreshToken(refreshToken));
    if (!tokenRecord) {
      throw new Error("Invalid refresh token");
    }

    if (new Date(tokenRecord.expiresAt) < new Date()) {
      await Promise.resolve(this.store.revokeRefreshToken(refreshToken));
      throw new Error("Refresh token expired");
    }

    const user = await Promise.resolve(this.store.getUserById(tokenRecord.userId));
    if (!user || !user.isActive) {
      throw new Error("User not found or disabled");
    }

    // Revoke old refresh token (rotation)
    await Promise.resolve(this.store.revokeRefreshToken(refreshToken));

    return this.generateTokens(user);
  }

  async logout(refreshToken: string): Promise<void> {
    await Promise.resolve(this.store.revokeRefreshToken(refreshToken));
  }

  async logoutAll(userId: string): Promise<void> {
    await Promise.resolve(this.store.revokeAllUserTokens(userId));
  }

  async getUser(userId: string): Promise<AuthUser | undefined> {
    const user = await Promise.resolve(this.store.getUserById(userId));
    if (!user) return undefined;
    return this.sanitizeUser(user);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await Promise.resolve(this.store.getUserById(userId));
    if (!user) throw new Error("User not found");

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new Error("Current password is incorrect");

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await Promise.resolve(this.store.updateUser(userId, { passwordHash }));

    // Revoke all refresh tokens after password change
    await Promise.resolve(this.store.revokeAllUserTokens(userId));
  }

  // Admin: invite a user to the org
  async inviteUser(inviterUserId: string, email: string, roles: Role[]): Promise<{ id: string; email: string; expiresAt: Date }> {
    const inviter = await Promise.resolve(this.store.getUserById(inviterUserId));
    if (!inviter || !inviter.roles.includes("admin")) {
      throw new Error("Only admins can invite users");
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await Promise.resolve(this.store.getUserByEmail(normalizedEmail));
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

    await Promise.resolve(this.store.createInvitation(invite));
    return { id: invite.id, email: normalizedEmail, expiresAt: invite.expiresAt };
  }

  // Admin: list team members
  async listTeamMembers(userId: string): Promise<any[]> {
    const user = await Promise.resolve(this.store.getUserById(userId));
    if (!user) throw new Error("User not found");
    return Promise.resolve(this.store.listUsersByOrg(user.orgId));
  }

  // Admin: update user roles
  async updateUserRoles(adminUserId: string, targetUserId: string, roles: Role[]): Promise<AuthUser> {
    const admin = await Promise.resolve(this.store.getUserById(adminUserId));
    if (!admin || !admin.roles.includes("admin")) {
      throw new Error("Only admins can update roles");
    }

    const target = await Promise.resolve(this.store.getUserById(targetUserId));
    if (!target || target.orgId !== admin.orgId) {
      throw new Error("User not found in organization");
    }

    const updated = await Promise.resolve(this.store.updateUser(targetUserId, { roles }));
    return this.sanitizeUser(updated);
  }

  // Admin: disable user
  async disableUser(adminUserId: string, targetUserId: string): Promise<void> {
    const admin = await Promise.resolve(this.store.getUserById(adminUserId));
    if (!admin || !admin.roles.includes("admin")) {
      throw new Error("Only admins can disable users");
    }

    if (adminUserId === targetUserId) {
      throw new Error("Cannot disable yourself");
    }

    const target = await Promise.resolve(this.store.getUserById(targetUserId));
    if (!target || target.orgId !== admin.orgId) {
      throw new Error("User not found in organization");
    }

    await Promise.resolve(this.store.updateUser(targetUserId, { isActive: false }));
    await Promise.resolve(this.store.revokeAllUserTokens(targetUserId));
  }

  private async generateTokens(user: any): Promise<TokenPair> {
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
    await Promise.resolve(this.store.createRefreshToken(user.id, refreshToken, expiresAt));

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



