import { AuditLogEntry } from "../types";

export class AuditLogService {
  constructor(private store: any) {}

  record(entry: Omit<AuditLogEntry, "id" | "timestamp">) {
    return this.store.addAudit(entry);
  }

  list(orgId: string) {
    return this.store.listAudit(orgId);
  }
}

