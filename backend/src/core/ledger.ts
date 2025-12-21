import { AuditLogService } from "./security/auditLog";
import { JournalEntry, JournalLine, JournalStatus } from "./types";
import { IStore } from "./store.interface";
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
  constructor(private store: IStore, private audit: AuditLogService) {}

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

  async createDraft(input: DraftInput): Promise<JournalEntry> {
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
    await Promise.resolve(this.store.addJournal(journal));
    await this.audit.record({
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
  async draft(input: DraftInput): Promise<JournalEntry> {
    return this.createDraft(input);
  }

  async review(id: string, reviewerId: string): Promise<JournalEntry> {
    const journal = await Promise.resolve(this.store.getJournal(id));
    if (!journal) throw new Error("Journal not found");
    if (journal.status !== "draft") throw new Error("Only draft journals can be reviewed");
    if (journal.createdBy === reviewerId) {
      throw new Error("Separation of duties enforced: different reviewer required");
    }
    await Promise.resolve(this.store.updateJournal(id, {
      status: "reviewed" as JournalStatus,
      reviewedBy: reviewerId
    }));
    const updated = await Promise.resolve(this.store.getJournal(id));
    await this.audit.record({
      orgId: journal.orgId,
      actorId: reviewerId,
      action: "journal.review",
      entity: "journal",
      entityId: journal.id,
      before: journal as unknown as Record<string, unknown>,
      after: updated as unknown as Record<string, unknown>
    });
    return updated!;
  }

  async post(id: string, posterId: string): Promise<JournalEntry> {
    const journal = await Promise.resolve(this.store.getJournal(id));
    if (!journal) throw new Error("Journal not found");
    if (journal.status !== "reviewed") throw new Error("Only reviewed journals can be posted");
    const isLocked = await Promise.resolve(this.store.isPeriodLocked(journal.orgId, journal.period));
    if (isLocked) {
      throw new Error("Period is locked");
    }
    await Promise.resolve(this.store.updateJournal(id, {
      status: "posted" as JournalStatus,
      postedBy: posterId
    }));
    const updated = await Promise.resolve(this.store.getJournal(id));
    await this.audit.record({
      orgId: journal.orgId,
      actorId: posterId,
      action: "journal.post",
      entity: "journal",
      entityId: journal.id,
      before: journal as unknown as Record<string, unknown>,
      after: updated as unknown as Record<string, unknown>
    });
    return updated!;
  }

  async lockPeriod(orgId: string, period: string, lockedBy: string): Promise<void> {
    const isLocked = await Promise.resolve(this.store.isPeriodLocked(orgId, period));
    if (isLocked) return;
    await Promise.resolve(this.store.lockPeriod({ orgId, period, lockedBy, lockedAt: new Date().toISOString() }));
    await this.audit.record({
      orgId,
      actorId: lockedBy,
      action: "period.lock",
      entity: "period",
      entityId: `${orgId}-${period}`
    });
  }

  async balances(orgId: string, period?: string): Promise<Map<string, number>> {
    const journals = await Promise.resolve(this.store.listJournals(orgId));
    const posted = journals.filter((j: JournalEntry) => j.status === "posted" && (!period || j.period === period));

    const balances = new Map<string, number>();
    posted.forEach((j: JournalEntry) => {
      j.lines.forEach((l) => {
        const current = balances.get(l.accountId) ?? 0;
        balances.set(l.accountId, current + l.debit - l.credit);
      });
    });
    return balances;
  }

  async list(orgId: string): Promise<JournalEntry[]> {
    return Promise.resolve(this.store.listJournals(orgId));
  }
}

