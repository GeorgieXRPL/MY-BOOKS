import { AuditLogService } from "./security/auditLog";
import { JournalEntry, JournalLine, JournalStatus } from "./types";
import { newId } from "../utils/id";

interface DraftLineInput {
  accountId: string;
  debit: number;
  credit: number;
  currency: string;
  description?: string;
  walletId?: string;
  tokenSymbol?: string;
  fxRate?: number;
  externalRef?: string;
  txHash?: string;
}

export interface DraftInput {
  orgId: string;
  period: string; // YYYY-MM
  lines: DraftLineInput[] | JournalLine[];
  memo?: string;
  tags?: string[];
  createdBy: string;
  externalRef?: string;
}

export class LedgerService {
  constructor(private store: any, private audit: AuditLogService) {}

  private validateLines(lines: JournalLine[]) {
    const debit = lines.reduce((sum, l) => sum + l.debit, 0);
    const credit = lines.reduce((sum, l) => sum + l.credit, 0);
    if (Math.abs(debit - credit) > 0.0001) {
      throw new Error("Journal is not balanced");
    }
    if (lines.some((l) => l.debit < 0 || l.credit < 0)) {
      throw new Error("Debits/credits must be positive");
    }
  }

  createDraft(input: DraftInput) {
    // Ensure all lines have IDs
    const linesWithIds: JournalLine[] = input.lines.map(line => ({
      ...line,
      id: (line as any).id || newId()
    }));
    this.validateLines(linesWithIds);
    const now = new Date().toISOString();
    const journal: JournalEntry = {
      id: newId(),
      status: "draft",
      createdAt: now,
      updatedAt: now,
      ...input,
      lines: linesWithIds
    };
    this.store.addJournal(journal);
    this.audit.record({
      orgId: input.orgId,
      actorId: input.createdBy,
      action: "journal.create",
      entity: "journal",
      entityId: journal.id,
      after: journal as unknown as Record<string, unknown>
    });
    return journal;
  }

  // Alias for createDraft - used by payroll/depreciation modules
  draft(input: DraftInput) {
    return this.createDraft(input);
  }

  review(id: string, reviewerId: string) {
    const journal = this.store.getJournal(id);
    if (!journal) throw new Error("Journal not found");
    if (journal.status !== "draft") throw new Error("Only draft journals can be reviewed");
    if (journal.createdBy === reviewerId) {
      throw new Error("Separation of duties enforced: different reviewer required");
    }
    const updated = this.store.updateJournal(id, {
      status: "reviewed" as JournalStatus,
      reviewedBy: reviewerId
    });
    this.audit.record({
      orgId: journal.orgId,
      actorId: reviewerId,
      action: "journal.review",
      entity: "journal",
      entityId: journal.id,
      before: journal,
      after: updated
    });
    return updated;
  }

  post(id: string, posterId: string) {
    const journal = this.store.getJournal(id);
    if (!journal) throw new Error("Journal not found");
    if (journal.status !== "reviewed") throw new Error("Only reviewed journals can be posted");
    if (this.store.isPeriodLocked(journal.orgId, journal.period)) {
      throw new Error("Period is locked");
    }
    const updated = this.store.updateJournal(id, {
      status: "posted" as JournalStatus,
      postedBy: posterId
    });
    this.audit.record({
      orgId: journal.orgId,
      actorId: posterId,
      action: "journal.post",
      entity: "journal",
      entityId: journal.id,
      before: journal,
      after: updated
    });
    return updated;
  }

  lockPeriod(orgId: string, period: string, lockedBy: string) {
    if (this.store.isPeriodLocked(orgId, period)) return;
    this.store.lockPeriod({ orgId, period, lockedBy, lockedAt: new Date().toISOString() });
    this.audit.record({
      orgId,
      actorId: lockedBy,
      action: "period.lock",
      entity: "period",
      entityId: `${orgId}-${period}`
    });
  }

  balances(orgId: string, period?: string) {
    const posted = this.store
      .listJournals(orgId)
      .filter((j) => j.status === "posted" && (!period || j.period === period));

    const balances = new Map<string, number>();
    posted.forEach((j) => {
      j.lines.forEach((l) => {
        const current = balances.get(l.accountId) ?? 0;
        balances.set(l.accountId, current + l.debit - l.credit);
      });
    });
    return balances;
  }

  list(orgId: string) {
    return this.store.listJournals(orgId);
  }
}

