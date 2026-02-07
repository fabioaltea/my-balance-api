import { TransactionsHelper, ITransactionFilters } from "./transactions.helper";
import { ITransaction } from "../../models";

/**
 * Interfaccia per aggregazioni mensili
 */
export interface IMonthlyAggregation {
  income: number;
  expense: number;
  balance: number;
  count: number;
}

/**
 * Interfaccia per risposta aggregazioni mensili
 */
export interface IMonthlyAggregations {
  [yearMonth: string]: IMonthlyAggregation; // formato: "2024-01"
}

export class AggregationsHelper {
  /**
   * GET /aggregations/monthly - Pre-calcola aggregazioni mensili per grafici
   * @param authClient - Google auth client
   * @param spreadsheetId - The spreadsheet ID
   * @param from_date - Start date in dd-MM-yyyy format (optional)
   * @param to_date - End date in dd-MM-yyyy format (optional)
   * @returns Monthly aggregations object
   */
  public static async getMonthlyAggregations(
    authClient: any,
    spreadsheetId: string,
    from_date?: string,
    to_date?: string
  ): Promise<IMonthlyAggregations> {
    // Fetch transactions with date filters
    const filters: ITransactionFilters = {
      limit: 10000, // Get all transactions within date range
    };
    
    if (from_date) {
      filters.from_date = from_date;
    }
    if (to_date) {
      filters.to_date = to_date;
    }

    const transactions = await TransactionsHelper.listTransactions(
      authClient,
      spreadsheetId,
      filters
    );

    // Aggregate by month
    const aggregations: IMonthlyAggregations = {};

    transactions.forEach((transaction) => {
      // Skip transactions with status "recurrent" (template) or "unconfirmed"
      const status = transaction.status?.toLowerCase();
      if (status === "recurrent" || status === "unconfirmed") {
        return;
      }

      // Parse transaction date (dd-MM-yyyy format)
      const yearMonth = this.extractYearMonth(transaction.date);
      if (!yearMonth) return;

      // Initialize aggregation for this month if not exists
      if (!aggregations[yearMonth]) {
        aggregations[yearMonth] = {
          income: 0,
          expense: 0,
          balance: 0,
          count: 0,
        };
      }

      // Parse amount
      const amount = this.parseAmount(transaction.amount);
      if (isNaN(amount)) return;

      // Update aggregation based on transaction type
      // Type field takes precedence for categorization
      if (transaction.type === "in") {
        // Income: add absolute value
        aggregations[yearMonth].income += Math.abs(amount);
      } else if (transaction.type === "out") {
        // Expense: add absolute value
        aggregations[yearMonth].expense += Math.abs(amount);
      } else {
        // Fallback: if no type, use amount sign (negative = expense, positive = income)
        if (amount >= 0) {
          aggregations[yearMonth].income += Math.abs(amount);
        } else {
          aggregations[yearMonth].expense += Math.abs(amount);
        }
      }

      aggregations[yearMonth].count += 1;
    });

    // Calculate balance for each month (income - expense)
    Object.keys(aggregations).forEach((yearMonth) => {
      aggregations[yearMonth].balance =
        aggregations[yearMonth].income - aggregations[yearMonth].expense;
      
      // Round to 2 decimal places
      aggregations[yearMonth].income = Math.round(aggregations[yearMonth].income * 100) / 100;
      aggregations[yearMonth].expense = Math.round(aggregations[yearMonth].expense * 100) / 100;
      aggregations[yearMonth].balance = Math.round(aggregations[yearMonth].balance * 100) / 100;
    });

    return aggregations;
  }

  /**
   * Extract year-month string (yyyy-MM) from date in dd-MM-yyyy format
   */
  private static extractYearMonth(dateStr: string): string | null {
    if (!dateStr) return null;

    // Handle dd-MM-yyyy format
    const match = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (match) {
      const [, , month, year] = match;
      return `${year}-${month}`;
    }

    return null;
  }

  /**
   * Parse amount string to number
   */
  private static parseAmount(amountStr: string | number): number {
    if (typeof amountStr === "number") return amountStr;
    if (!amountStr) return 0;

    let raw = String(amountStr).trim();
    // Remove currency symbols and spaces
    raw = raw.replace(/[€\s]/g, "");

    const hasComma = raw.includes(",");
    const hasDot = raw.includes(".");

    if (hasComma && hasDot) {
      // If both exist, the last separator is the decimal one
      const lastComma = raw.lastIndexOf(",");
      const lastDot = raw.lastIndexOf(".");
      if (lastComma > lastDot) {
        // EU format: "." thousands, "," decimal
        raw = raw.replace(/\./g, "").replace(/,/g, ".");
      } else {
        // US format: "," thousands, "." decimal
        raw = raw.replace(/,/g, "");
      }
    } else if (hasComma && !hasDot) {
      // Only comma -> decimal
      raw = raw.replace(/,/g, ".");
    }

    const parsed = parseFloat(raw.replace(/[^0-9.\-]/g, ""));
    return isNaN(parsed) ? 0 : parsed;
  }
}
