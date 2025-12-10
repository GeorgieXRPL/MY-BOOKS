import { DbStore } from "../store.db";
import { Asset, DepreciationEntry, DepreciationMethod } from "../types";
import { newId } from "../../utils/id";
import { LedgerService } from "../ledger";

interface CreateAssetInput {
  orgId: string;
  name: string;
  description?: string;
  category: string;
  purchaseDate: string;
  cost: number;
  salvageValue: number;
  usefulLifeMonths: number;
  depreciationMethod: DepreciationMethod;
  accountId: string;
  depreciationAccountId: string;
  currency: string;
}

export class DepreciationService {
  constructor(private store: DbStore, private ledger: LedgerService) {}

  // ============ ASSETS ============
  addAsset(input: CreateAssetInput): Asset {
    const asset: Asset = {
      id: newId(),
      orgId: input.orgId,
      name: input.name,
      description: input.description,
      category: input.category,
      purchaseDate: input.purchaseDate,
      cost: input.cost,
      salvageValue: input.salvageValue,
      usefulLifeMonths: input.usefulLifeMonths,
      depreciationMethod: input.depreciationMethod,
      accountId: input.accountId,
      depreciationAccountId: input.depreciationAccountId,
      currency: input.currency,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.store.addAsset(asset);
    return asset;
  }

  listAssets(orgId: string) {
    return this.store.listAssets(orgId);
  }

  getAsset(id: string) {
    return this.store.getAsset(id);
  }

  // ============ DEPRECIATION CALCULATIONS ============
  calculateMonthlyDepreciation(asset: Asset): number {
    const depreciableAmount = asset.cost - asset.salvageValue;

    switch (asset.depreciationMethod) {
      case "straight-line":
        return depreciableAmount / asset.usefulLifeMonths;

      case "declining-balance":
        // Double declining balance rate
        const annualRate = (2 / (asset.usefulLifeMonths / 12)) * 100;
        const entries = this.store.listDepreciationEntries(asset.id);
        const accumulated = entries.length > 0 ? entries[entries.length - 1].accumulatedDepreciation : 0;
        const bookValue = asset.cost - accumulated;
        const yearlyDep = bookValue * (annualRate / 100);
        return Math.min(yearlyDep / 12, bookValue - asset.salvageValue);

      case "units-of-production":
        // Simplified: treat as straight-line for now
        return depreciableAmount / asset.usefulLifeMonths;

      default:
        return depreciableAmount / asset.usefulLifeMonths;
    }
  }

  getDepreciationSchedule(assetId: string): DepreciationEntry[] {
    return this.store.listDepreciationEntries(assetId);
  }

  generateSchedule(asset: Asset): DepreciationEntry[] {
    const entries: DepreciationEntry[] = [];
    const startDate = new Date(asset.purchaseDate);
    let accumulated = 0;

    for (let i = 0; i < asset.usefulLifeMonths; i++) {
      const periodDate = new Date(startDate);
      periodDate.setMonth(periodDate.getMonth() + i);
      const period = `${periodDate.getFullYear()}-${String(periodDate.getMonth() + 1).padStart(2, "0")}`;

      let amount: number;
      if (asset.depreciationMethod === "declining-balance") {
        const annualRate = (2 / (asset.usefulLifeMonths / 12)) * 100;
        const bookValue = asset.cost - accumulated;
        amount = Math.min((bookValue * annualRate) / 100 / 12, bookValue - asset.salvageValue);
      } else {
        amount = (asset.cost - asset.salvageValue) / asset.usefulLifeMonths;
      }

      // Don't depreciate below salvage value
      if (accumulated + amount > asset.cost - asset.salvageValue) {
        amount = asset.cost - asset.salvageValue - accumulated;
      }

      if (amount <= 0) break;

      accumulated += amount;

      entries.push({
        id: newId(),
        assetId: asset.id,
        period,
        amount,
        accumulatedDepreciation: accumulated,
        bookValue: asset.cost - accumulated,
        createdAt: new Date().toISOString()
      });
    }

    return entries;
  }

  // ============ RECORD DEPRECIATION ============
  recordMonthlyDepreciation(assetId: string, period: string, actorId: string): DepreciationEntry {
    const asset = this.store.getAsset(assetId);
    if (!asset) throw new Error("Asset not found");
    if (!asset.isActive) throw new Error("Asset is not active");

    // Check if already recorded for this period
    const existing = this.store.listDepreciationEntries(assetId);
    if (existing.find((e) => e.period === period)) {
      throw new Error(`Depreciation already recorded for ${period}`);
    }

    const accumulated = existing.length > 0 ? existing[existing.length - 1].accumulatedDepreciation : 0;
    const amount = this.calculateMonthlyDepreciation(asset);

    if (amount <= 0) {
      throw new Error("Asset fully depreciated");
    }

    const entry: DepreciationEntry = {
      id: newId(),
      assetId,
      period,
      amount,
      accumulatedDepreciation: accumulated + amount,
      bookValue: asset.cost - accumulated - amount,
      createdAt: new Date().toISOString()
    };

    // Create journal entry
    const journal = this.ledger.draft({
      orgId: asset.orgId,
      period,
      lines: [
        {
          id: newId(),
          accountId: asset.depreciationAccountId,
          debit: amount,
          credit: 0,
          currency: asset.currency,
          description: `Depreciation - ${asset.name}`
        },
        {
          id: newId(),
          accountId: asset.accountId,
          debit: 0,
          credit: amount,
          currency: asset.currency,
          description: `Accumulated depreciation - ${asset.name}`
        }
      ],
      memo: `Monthly depreciation for ${asset.name}`,
      createdBy: actorId,
      externalRef: `depreciation-${assetId}-${period}`
    });

    entry.journalId = journal.id;
    this.store.addDepreciationEntry(entry);

    return entry;
  }

  // ============ REPORTS ============
  assetRegister(orgId: string) {
    const assets = this.store.listAssets(orgId);

    return assets.map((asset) => {
      const entries = this.store.listDepreciationEntries(asset.id);
      const accumulated = entries.length > 0 ? entries[entries.length - 1].accumulatedDepreciation : 0;

      return {
        ...asset,
        accumulatedDepreciation: accumulated,
        bookValue: asset.cost - accumulated,
        remainingLife: Math.max(0, asset.usefulLifeMonths - entries.length)
      };
    });
  }

  depreciationSummary(orgId: string, period: string) {
    const assets = this.store.listAssets(orgId).filter((a) => a.isActive);

    const entries = assets.flatMap((a) =>
      this.store.listDepreciationEntries(a.id).filter((e) => e.period === period)
    );

    return {
      period,
      totalDepreciation: entries.reduce((s, e) => s + e.amount, 0),
      assetCount: assets.length,
      entries: entries.map((e) => {
        const asset = assets.find((a) => a.id === e.assetId);
        return {
          ...e,
          assetName: asset?.name
        };
      })
    };
  }
}

