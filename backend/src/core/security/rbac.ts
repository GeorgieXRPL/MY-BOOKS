import { Role } from "../types";

export class RbacService {
  constructor(private store: any) {}

  assign(userId: string, roles: Role[]) {
    this.store.upsertRole(userId, roles);
    return { userId, roles };
  }

  hasRole(userId: string, role: Role) {
    return this.store.getUserRoles(userId).includes(role);
  }

  require(userId: string, roles: Role[]) {
    const userRoles = this.store.getUserRoles(userId);
    const ok = roles.some((r) => userRoles.includes(r));
    if (!ok) {
      throw new Error("Forbidden: missing role");
    }
  }
}

