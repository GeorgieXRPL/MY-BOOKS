import { DbStore } from "../store.db";
import { TaxRate, Invoice, Expense } from "../types";
import { newId } from "../../utils/id";

interface TaxCalculation {
  grossAmount: number;
  taxRate: number;
  taxAmount: number;
  netAmount: number;
}

export class TaxService {
  constructor(private store: DbStore) {}

  // ============ TAX RATES ============
  addTaxRate(rate: Omit<TaxRate, "id">): TaxRate {
    const taxRate: TaxRate = { ...rate, id: newId() };
    this.store.addTaxRate(taxRate);
    return taxRate;
  }

  listTaxRates(orgId: string) {
    return this.store.listTaxRates(orgId);
  }

  getDefaultRate(orgId: string, type: TaxRate["type"]) {
    return this.store.getDefaultTaxRate(orgId, type);
  }

  // ============ CALCULATIONS ============
  calculateTax(amount: number, rate: number): TaxCalculation {
    const taxAmount = amount * (rate / 100);
    return {
      grossAmount: amount,
      taxRate: rate,
      taxAmount,
      netAmount: amount + taxAmount
    };
  }

  calculateTaxInclusive(totalWithTax: number, rate: number): TaxCalculation {
    const netAmount = totalWithTax / (1 + rate / 100);
    const taxAmount = totalWithTax - netAmount;
    return {
      grossAmount: netAmount,
      taxRate: rate,
      taxAmount,
      netAmount: totalWithTax
    };
  }

  // ============ SUMMARIES ============
  salesTaxSummary(orgId: string, startDate: string, endDate: string) {
    const invoices = this.store.listInvoices(orgId).filter(
      (i) => i.issueDate >= startDate && i.issueDate <= endDate && i.type === "receivable"
    );

    const collected = invoices.reduce((s, i) => s + i.taxAmount, 0);
    const sales = invoices.reduce((s, i) => s + i.subtotal, 0);

    const expenses = this.store.listExpenses(orgId).filter(
      (e) => e.date >= startDate && e.date <= endDate
    );

    const paid = expenses.reduce((s, e) => s + e.taxAmount, 0);

    return {
      period: { startDate, endDate },
      taxCollected: collected,
      taxPaid: paid,
      netTaxPayable: collected - paid,
      totalSales: sales,
      totalExpenses: expenses.reduce((s, e) => s + e.amount, 0)
    };
  }

  payrollTaxSummary(orgId: string, year: string) {
    const runs = this.store.listPayrollRuns(orgId).filter(
      (r) => r.period.startsWith(year) && r.status === "finalized"
    );

    return {
      year,
      totalGrossWages: runs.reduce((s, r) => s + r.totalGross, 0),
      totalTaxWithheld: runs.reduce((s, r) => s + r.totalTax, 0),
      runCount: runs.length,
      byPeriod: runs.map((r) => ({
        period: r.period,
        gross: r.totalGross,
        tax: r.totalTax
      }))
    };
  }

  // BAS/VAT return preview (simplified)
  basPreview(orgId: string, quarter: string) {
    // quarter format: "2024-Q1"
    const [year, q] = quarter.split("-Q");
    const qNum = parseInt(q);
    const startMonth = (qNum - 1) * 3 + 1;
    const endMonth = qNum * 3;

    const startDate = `${year}-${String(startMonth).padStart(2, "0")}-01`;
    const endDate = `${year}-${String(endMonth).padStart(2, "0")}-31`;

    const summary = this.salesTaxSummary(orgId, startDate, endDate);

    return {
      quarter,
      ...summary,
      estimatedPayment: Math.max(0, summary.netTaxPayable)
    };
  }

  // Income tax provision estimate (simplified)
  incomeTaxProvision(orgId: string, year: string, corporateTaxRate: number) {
    const invoices = this.store.listInvoices(orgId).filter(
      (i) => i.issueDate.startsWith(year) && i.type === "receivable" && i.status === "paid"
    );
    const revenue = invoices.reduce((s, i) => s + i.subtotal, 0);

    const expenses = this.store.listExpenses(orgId).filter(
      (e) => e.date.startsWith(year) && e.status === "paid"
    );
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

    const taxableIncome = Math.max(0, revenue - totalExpenses);
    const taxProvision = taxableIncome * (corporateTaxRate / 100);

    return {
      year,
      revenue,
      expenses: totalExpenses,
      taxableIncome,
      corporateTaxRate,
      taxProvision
    };
  }
}

