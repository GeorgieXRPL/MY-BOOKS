import { Role } from "../types";
import { IStore } from "../store.interface";

export class RbacService {
  constructor(private store: IStore) {}

  async assign(userId: string, roles: Role[]): Promise<{ userId: string; roles: Role[] }> {
    await Promise.resolve(this.store.upsertRole(userId, roles));
    return { userId, roles };
  }

  async hasRole(userId: string, role: Role): Promise<boolean> {
    const userRoles = await Promise.resolve(this.store.getUserRoles(userId));
    return userRoles.includes(role);
  }

  async require(userId: string, roles: Role[]): Promise<void> {
    const userRoles = await Promise.resolve(this.store.getUserRoles(userId));
    const ok = roles.some((r) => userRoles.includes(r));
    if (!ok) {
      throw new Error("Forbidden: missing role");
    }
  }
}

