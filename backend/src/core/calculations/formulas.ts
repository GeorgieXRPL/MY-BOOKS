import { IStore } from "../store.interface";
import { Formula } from "../types";
import { newId } from "../../utils/id";
import { ReportingService } from "../reporting";

interface FormulaContext {
  [key: string]: number;
}

interface FormulaResult {
  formula: Formula;
  result: number;
  variables: FormulaContext;
}

export class FormulaService {
  constructor(private store: IStore, private reporting: ReportingService) {}

  // ============ FORMULA CRUD ============
  async create(input: Omit<Formula, "id" | "createdAt" | "updatedAt">): Promise<Formula> {
    const formula: Formula = {
      ...input,
      id: newId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Validate expression
    this.validateExpression(formula.expression, formula.variables);

    await Promise.resolve(this.store.addFormula(formula));
    return formula;
  }

  async get(id: string): Promise<Formula | undefined> {
    return Promise.resolve(this.store.getFormula(id));
  }

  async list(orgId: string, category?: string): Promise<Formula[]> {
    let formulas = await Promise.resolve(this.store.listFormulas(orgId));
    if (category) {
      formulas = formulas.filter((f) => f.category === category);
    }
    return formulas;
  }

  async update(id: string, patch: Partial<Omit<Formula, "id" | "createdAt">>): Promise<Formula> {
    const existing = await Promise.resolve(this.store.getFormula(id));
    if (!existing) throw new Error("Formula not found");

    if (patch.expression || patch.variables) {
      this.validateExpression(
        patch.expression || existing.expression,
        patch.variables || existing.variables
      );
    }

    const updated: Formula = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString()
    };

    await Promise.resolve(this.store.addFormula(updated));
    return updated;
  }

  // ============ VALIDATION ============
  private validateExpression(expression: string, variables: string[]) {
    // Check for dangerous patterns
    const dangerous = ["eval", "Function", "import", "require", "process", "window", "document"];
    for (const d of dangerous) {
      if (expression.includes(d)) {
        throw new Error(`Expression contains forbidden keyword: ${d}`);
      }
    }

    // Check all variables are declared
    const varPattern = /[a-zA-Z_][a-zA-Z0-9_]*/g;
    const usedVars = expression.match(varPattern) || [];
    const mathFunctions = ["Math", "abs", "ceil", "floor", "round", "max", "min", "pow", "sqrt", "log"];
    const operators = ["if", "else", "true", "false"];

    for (const v of usedVars) {
      if (!variables.includes(v) && !mathFunctions.includes(v) && !operators.includes(v)) {
        // It might be a number or part of Math.xxx
        if (isNaN(Number(v)) && !v.startsWith("Math")) {
          throw new Error(`Unknown variable: ${v}`);
        }
      }
    }
  }

  // ============ EVALUATION ============
  async evaluate(formulaId: string, context: FormulaContext): Promise<FormulaResult> {
    const formula = await Promise.resolve(this.store.getFormula(formulaId));
    if (!formula) throw new Error("Formula not found");

    // Check all required variables are provided
    for (const v of formula.variables) {
      if (context[v] === undefined) {
        throw new Error(`Missing variable: ${v}`);
      }
    }

    // Safe evaluation using Function constructor with limited scope
    const result = this.safeEval(formula.expression, context);

    return {
      formula,
      result,
      variables: context
    };
  }

  private safeEval(expression: string, context: FormulaContext): number {
    // Build variable declarations
    const varDeclarations = Object.entries(context)
      .map(([k, v]) => `const ${k} = ${v};`)
      .join("\n");

    // Wrap in try-catch and return
    const code = `
      ${varDeclarations}
      return (${expression});
    `;

    try {
      // Create function with Math in scope
      const fn = new Function("Math", code);
      const result = fn(Math);

      if (typeof result !== "number" || isNaN(result)) {
        throw new Error("Expression did not return a valid number");
      }

      return result;
    } catch (e: any) {
      throw new Error(`Evaluation error: ${e.message}`);
    }
  }

  // ============ AUTO CONTEXT ============
  async buildContext(orgId: string, period?: string): Promise<FormulaContext> {
    const bs = await this.reporting.balanceSheet(orgId, period);
    const is = await this.reporting.incomeStatement(orgId, period);

    return {
      // Balance Sheet
      totalAssets: bs.totals.assets,
      totalLiabilities: bs.totals.liabilities,
      totalEquity: bs.totals.equity,

      // Income Statement
      totalRevenue: is.totals.revenue,
      totalExpenses: is.totals.expenses,
      netIncome: is.totals.netIncome,

      // Derived
      grossProfit: is.totals.revenue - is.totals.expenses * 0.6,
      workingCapital: bs.totals.assets - bs.totals.liabilities
    };
  }

  async evaluateWithAutoContext(formulaId: string, orgId: string, period?: string, additionalContext?: FormulaContext): Promise<FormulaResult> {
    const autoContext = await this.buildContext(orgId, period);
    const fullContext = { ...autoContext, ...additionalContext };

    return this.evaluate(formulaId, fullContext);
  }

  // ============ BATCH EVALUATION ============
  async evaluateAll(orgId: string, period?: string): Promise<FormulaResult[]> {
    const formulas = await Promise.resolve(this.store.listFormulas(orgId));
    const context = await this.buildContext(orgId, period);

    const results: FormulaResult[] = [];

    for (const formula of formulas) {
      try {
        // Check if all variables are available in context
        const missingVars = formula.variables.filter((v) => context[v] === undefined);
        if (missingVars.length > 0) {
          continue; // Skip formulas with missing variables
        }

        const result = await this.evaluate(formula.id, context);
        results.push(result);
      } catch {
        // Skip formulas that fail
      }
    }

    return results;
  }

  // ============ PRESETS ============
  getPresetFormulas(): Omit<Formula, "id" | "orgId" | "createdBy" | "createdAt" | "updatedAt">[] {
    return [
      {
        name: "Working Capital",
        description: "Current assets minus current liabilities",
        expression: "totalAssets - totalLiabilities",
        variables: ["totalAssets", "totalLiabilities"],
        category: "liquidity"
      },
      {
        name: "Profit Margin",
        description: "Net income as percentage of revenue",
        expression: "(netIncome / totalRevenue) * 100",
        variables: ["netIncome", "totalRevenue"],
        category: "profitability"
      },
      {
        name: "Operating Ratio",
        description: "Operating expenses as percentage of revenue",
        expression: "(totalExpenses / totalRevenue) * 100",
        variables: ["totalExpenses", "totalRevenue"],
        category: "efficiency"
      },
      {
        name: "Equity Multiplier",
        description: "Total assets divided by equity",
        expression: "totalAssets / totalEquity",
        variables: ["totalAssets", "totalEquity"],
        category: "leverage"
      },
      {
        name: "Break-Even Revenue",
        description: "Revenue needed to cover expenses",
        expression: "totalExpenses / (1 - (totalExpenses * 0.6 / totalRevenue))",
        variables: ["totalExpenses", "totalRevenue"],
        category: "planning"
      }
    ];
  }

  async seedPresets(orgId: string, createdBy: string): Promise<Formula[]> {
    const presets = this.getPresetFormulas();
    const created: Formula[] = [];

    for (const preset of presets) {
      const formula = await this.create({
        ...preset,
        orgId,
        createdBy
      });
      created.push(formula);
    }

    return created;
  }
}
