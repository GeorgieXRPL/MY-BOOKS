import { IStore } from "../store.interface";
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
  constructor(private store: IStore, private ledger: LedgerService) {}

  // ============ ASSETS ============
  async addAsset(input: CreateAssetInput): Promise<Asset> {
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

    await Promise.resolve(this.store.addAsset(asset));
    return asset;
  }

  async listAssets(orgId: string): Promise<Asset[]> {
    return Promise.resolve(this.store.listAssets(orgId));
  }

  async getAsset(id: string): Promise<Asset | undefined> {
    return Promise.resolve(this.store.getAsset(id));
  }

  // ============ DEPRECIATION CALCULATIONS ============
  async calculateMonthlyDepreciation(asset: Asset): Promise<number> {
    const depreciableAmount = asset.cost - asset.salvageValue;

    switch (asset.depreciationMethod) {
      case "straight-line":
        return depreciableAmount / asset.usefulLifeMonths;

      case "declining-balance":
        // Double declining balance rate
        const annualRate = (2 / (asset.usefulLifeMonths / 12)) * 100;
        const entries = await Promise.resolve(this.store.listDepreciationEntries(asset.id));
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

  async getDepreciationSchedule(assetId: string): Promise<DepreciationEntry[]> {
    return Promise.resolve(this.store.listDepreciationEntries(assetId));
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
  async recordMonthlyDepreciation(assetId: string, period: string, actorId: string): Promise<DepreciationEntry> {
    const asset = await Promise.resolve(this.store.getAsset(assetId));
    if (!asset) throw new Error("Asset not found");
    if (!asset.isActive) throw new Error("Asset is not active");

    // Check if already recorded for this period
    const existing = await Promise.resolve(this.store.listDepreciationEntries(assetId));
    if (existing.find((e) => e.period === period)) {
      throw new Error(`Depreciation already recorded for ${period}`);
    }

    const accumulated = existing.length > 0 ? existing[existing.length - 1].accumulatedDepreciation : 0;
    const amount = await this.calculateMonthlyDepreciation(asset);

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
    const journal = await this.ledger.draft({
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
    await Promise.resolve(this.store.addDepreciationEntry(entry));

    return entry;
  }

  // ============ REPORTS ============
  async assetRegister(orgId: string) {
    const assets = await Promise.resolve(this.store.listAssets(orgId));

    const results = [];
    for (const asset of assets) {
      const entries = await Promise.resolve(this.store.listDepreciationEntries(asset.id));
      const accumulated = entries.length > 0 ? entries[entries.length - 1].accumulatedDepreciation : 0;

      results.push({
        ...asset,
        accumulatedDepreciation: accumulated,
        bookValue: asset.cost - accumulated,
        remainingLife: Math.max(0, asset.usefulLifeMonths - entries.length)
      });
    }

    return results;
  }

  async depreciationSummary(orgId: string, period: string) {
    const allAssets = await Promise.resolve(this.store.listAssets(orgId));
    const assets = allAssets.filter((a) => a.isActive);

    const entries = [];
    for (const a of assets) {
      const assetEntries = await Promise.resolve(this.store.listDepreciationEntries(a.id));
      const periodEntries = assetEntries.filter((e) => e.period === period);
      entries.push(...periodEntries);
    }

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



