import { AuditLogEntry } from "../types";
import { IStore } from "../store.interface";

export class AuditLogService {
  constructor(private store: IStore) {}

  async record(entry: Omit<AuditLogEntry, "id" | "timestamp">): Promise<void> {
    await Promise.resolve(this.store.addAudit(entry));
  }

  // Alias for record - used by business modules
  async log(entry: Omit<AuditLogEntry, "id" | "timestamp">): Promise<void> {
    await this.record(entry);
  }

  async list(orgId: string): Promise<AuditLogEntry[]> {
    return Promise.resolve(this.store.listAudit(orgId));
  }
}

