import { AuditLogEntry } from "../types";

export class AuditLogService {
  constructor(private store: any) {}

  record(entry: Omit<AuditLogEntry, "id" | "timestamp">) {
    return this.store.addAudit(entry);
  }

  // Alias for record - used by business modules
  log(entry: Omit<AuditLogEntry, "id" | "timestamp">) {
    return this.record(entry);
  }

  list(orgId: string) {
    return this.store.listAudit(orgId);
  }
}

