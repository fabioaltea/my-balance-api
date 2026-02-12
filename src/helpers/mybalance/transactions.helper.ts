import { GoogleHelper } from "../google";
import {
  ITransaction,
  IMovement,
  ITransactionRowParseResult,
  IUpdateTransactionBodyData,
  IMovementRequest,
  ITransactionRequest,
} from "../../models";

// Mappatura colonne (0-based) del foglio "AllTransactions" — Schema v2.
// A: description (0)
// B: category (1)
// C: amount (2)
// D: date (3)
// E: type (4)
// F: account (5)
// G: status (6)
// H: location (7)
// I: notes (8)
// J: transactionId (9)
// K: movementId (10)
// L: recurrenceId (11)
// M: recurrencePattern (12)
// N: dateAdded (13)
// O: dateModified (14)
// P: dateDeleted (15)
const COLS = {
  DESCRIPTION: 0,
  CATEGORY: 1,
  AMOUNT: 2,
  DATE: 3,
  TYPE: 4,
  ACCOUNT: 5,
  STATUS: 6,
  LOCATION: 7,
  NOTES: 8,
  TRANSACTION_ID: 9,
  MOVEMENT_ID: 10,
  RECURRENCE_ID: 11,
  RECURRENCE_PATTERN: 12,
  DATE_ADDED: 13,
  DATE_MODIFIED: 14,
  DATE_DELETED: 15,
} as const;

// Range base usato per operazioni
const SHEET_RANGE = "AllTransactions!A2:Z";
const SHEET_NAME = "AllTransactions";

// Interfaccia per filtri opzionali
export interface ITransactionFilters {
  from_date?: string; // dd-MM-yyyy format
  to_date?: string; // dd-MM-yyyy format
  account?: string;
  category?: string;
  type?: "in" | "out";
  status?: string;
  limit?: number;
  offset?: number;
}

export class TransactionsHelper {
  // Pattern riconosciuto se già nel formato desiderato yyyy-MM-dd hh:mm
  private static DATE_TIME_REGEX = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/; // meta dates
  private static DATE_ONLY_REGEX = /^\d{2}-\d{2}-\d{4}$/; // movement date

  private static pad(n: number): string {
    return n < 10 ? "0" + n : String(n);
  }
  private static formatDateOnly(dt: Date): string {
    return `${this.pad(dt.getDate())}-${this.pad(
      dt.getMonth() + 1
    )}-${dt.getFullYear()}`;
  }
  private static formatDateTime(dt: Date): string {
    return `${dt.getFullYear()}-${this.pad(dt.getMonth() + 1)}-${this.pad(
      dt.getDate()
    )} ${this.pad(dt.getHours())}:${this.pad(dt.getMinutes())}`;
  }

  // Accetta qualunque valore e prova a normalizzare a "in" | "out".
  // Regole:
  // 1. Se type contiene in/out/entrata/income => in
  // 2. Se contiene out/expense/uscita => out
  // 3. Altrimenti deduce da amount: negativo => out, positivo => in
  // 4. Se non deducibile ritorna stringa vuota
  private static normalizeType(type: any, amount: any): string {
    const raw = (type == null ? "" : String(type)).trim().toLowerCase();
    if (
      raw === "in" ||
      raw === "entrata" ||
      raw === "income" ||
      raw === "deposit"
    )
      return "in";
    if (
      raw === "out" ||
      raw === "expense" ||
      raw === "uscita" ||
      raw === "withdraw"
    )
      return "out";
    const num = this.parseAmountToNumber(amount);
    if (!isNaN(num)) {
      if (num < 0) return "out";
      if (num >= 0) return "in";
    }
    return ""; // neutro se impossibile
  }

  // Prova a interpretare qualunque formato di data plausibile e convertirlo in dd/MM/yyyy hh:mm.
  // Accetta: formato target già valido, ISO (yyyy-MM-ddTHH:mm:ssZ), yyyy-MM-dd, dd/MM/yyyy, timestamp numerico.
  // Normalizza data movimento (senza tempo) -> dd-MM-yyyy
  private static normalizeMovementDate(input: any): string {
    if (!input) return this.formatDateOnly(new Date());
    const raw = String(input).trim();
    if (this.DATE_ONLY_REGEX.test(raw)) return raw; // già ok

    // dd/MM/yyyy
    const dmYSlash = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    if (dmYSlash.test(raw)) {
      const [d, m, y] = raw.split("/");
      return `${d}-${m}-${y}`;
    }

    // yyyy-MM-dd
    const yMd = /^(\d{4})-(\d{2})-(\d{2})$/;
    if (yMd.test(raw)) {
      const [y, m, d] = raw.split("-");
      return `${d}-${m}-${y}`;
    }

    // Timestamp numerico
    if (/^\d{10,13}$/.test(raw)) {
      const num = raw.length === 13 ? Number(raw) : Number(raw) * 1000;
      const dt = new Date(num);
      if (!isNaN(dt.getTime())) return this.formatDateOnly(dt);
    }

    // ISO o altro parseable
    const dt = new Date(raw);
    if (!isNaN(dt.getTime())) return this.formatDateOnly(dt);
    return this.formatDateOnly(new Date());
  }

  // Normalizza meta date (dateAdded / dateModified / dateDeleted) -> dd-MM-yyyy hh:mm
  private static normalizeMetaDate(input: any): string {
    if (input === null || input === undefined) return "";
    const raw = String(input).trim();
    if (raw === "") return ""; // stringa vuota rimane vuota
    if (this.DATE_TIME_REGEX.test(raw)) return raw; // già ok

    // dd-MM-yyyy senza tempo
    if (this.DATE_ONLY_REGEX.test(raw)) {
      return `${raw} 00:00`; // aggiunge 00:00
    }

    // dd/MM/yyyy
    const dmYSlash = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    if (dmYSlash.test(raw)) {
      const [d, m, y] = raw.split("/");
      return `${d}-${m}-${y} 00:00`;
    }

    // yyyy-MM-dd (senza tempo)
    const yMd = /^(\d{4})-(\d{2})-(\d{2})$/;
    if (yMd.test(raw)) {
      const [y, m, d] = raw.split("-");
      return `${d}-${m}-${y} 00:00`;
    }

    // Timestamp numerico
    if (/^\d{10,13}$/.test(raw)) {
      const num = raw.length === 13 ? Number(raw) : Number(raw) * 1000;
      const dt = new Date(num);
      if (!isNaN(dt.getTime())) return this.formatDateTime(dt);
    }

    // ISO parse
    const dt = new Date(raw);
    if (!isNaN(dt.getTime())) return this.formatDateTime(dt);
    return this.formatDateTime(new Date());
  }

  private static parseAmountToNumber(amount: any): number {
    if (amount === null || amount === undefined) return NaN;
    let raw = String(amount).trim();
    // Rimuovi simboli di valuta e spazi
    raw = raw.replace(/[€\s]/g, "");

    const hasComma = raw.includes(",");
    const hasDot = raw.includes(".");

    if (hasComma && hasDot) {
      // Determina il separatore decimale come l'ultimo tra , e .
      const lastComma = raw.lastIndexOf(",");
      const lastDot = raw.lastIndexOf(".");
      if (lastComma > lastDot) {
        // EU: . migliaia, , decimali
        raw = raw.replace(/\./g, "").replace(/,/g, ".");
      } else {
        // US: , migliaia, . decimali
        raw = raw.replace(/,/g, "");
      }
    } else if (hasComma && !hasDot) {
      // Solo la virgola come decimale
      raw = raw.replace(/,/g, ".");
    } else if (hasDot && !hasComma) {
      // Solo il punto come decimale
      // Nessuna trasformazione necessaria
    }

    raw = raw.replace(/[^0-9.\-]/g, "");
    const num = parseFloat(raw);
    return isNaN(num) ? NaN : num;
  }

  private static formatAmount(amount: any): string {
    const num = this.parseAmountToNumber(amount);
    if (isNaN(num)) return "";
    return num.toFixed(2); // sempre due decimali
  }

  private static cleanString(v?: string): string {
    return v ? v.trim() : "";
  }

  // Converte una riga Google Sheets in ITransaction
  private static rowToTransaction(
    row: any[],
    rowIndex: number
  ): ITransactionRowParseResult | null {
    try {
      const transactionId = row[COLS.TRANSACTION_ID];
      if (!transactionId) return null; // riga vuota / non valida
      const transaction: ITransaction = {
        description: this.cleanString(row[COLS.DESCRIPTION]) || "",
        category: this.cleanString(row[COLS.CATEGORY]) || "",
        amount: this.cleanString(row[COLS.AMOUNT]) || "", // Mantiene la stringa originale
        date: this.normalizeMovementDate(row[COLS.DATE]),
        type: this.normalizeType(
          row[COLS.TYPE],
          this.parseAmountToNumber(row[COLS.AMOUNT])
        ),
        account: this.cleanString(row[COLS.ACCOUNT]) || "",
        transactionId: transactionId,
        movementId: this.cleanString(row[COLS.MOVEMENT_ID]) || "",
        notes: this.cleanString(row[COLS.NOTES]) || "",
        location: this.cleanString(row[COLS.LOCATION]) || "",
        recurrenceId: this.cleanString(row[COLS.RECURRENCE_ID]) || "",
        recurrencePattern: this.cleanString(row[COLS.RECURRENCE_PATTERN]) || "",
        dateAdded: this.normalizeMetaDate(row[COLS.DATE_ADDED]),
        dateModified: this.normalizeMetaDate(row[COLS.DATE_MODIFIED]),
        dateDeleted: this.normalizeMetaDate(row[COLS.DATE_DELETED]),
        status: this.cleanString(row[COLS.STATUS]) || "Confirmed",
      };
      return { rowIndex: rowIndex + 1, transaction }; // 1-based index per uso in range
    } catch (ex) {
      return null;
    }
  }

  // ===== NUOVI METODI PER GESTIONE MOVEMENTS =====

  // Converte transactions in IMovement raggruppando per movementId
  private static groupTransactionsByMovement(
    transactions: ITransaction[]
  ): IMovement[] {
    const movementMap = new Map<string, ITransaction[]>();

    // Raggruppa per movementId
    transactions.forEach((t) => {
      if (!movementMap.has(t.movementId)) {
        movementMap.set(t.movementId, []);
      }
      movementMap.get(t.movementId)!.push(t);
    });

    // Converte ogni gruppo in IMovement
    return Array.from(movementMap.entries()).map(([movementId, txns]) => {
      const firstTx = txns[0];

      // Calcola la somma convertendo le stringhe amount in numeri
      const transactionsSum = txns.reduce((sum, t) => {
        const numAmount = this.parseAmountToNumber(t.amount);
        return sum + (isNaN(numAmount) ? 0 : numAmount);
      }, 0);

      return {
        movementId,
        description: firstTx.description,
        category: firstTx.category,
        date: firstTx.date,
        type: firstTx.type,
        location: firstTx.location,
        notes: firstTx.notes,
        recurrenceId: firstTx.recurrenceId,
        recurrencePattern: firstTx.recurrencePattern,
        status: firstTx.status,
        transactions: txns,
        transactionsSum,
      };
    });
  }

  // APPEND transactions (da richiesta movement)
  public static async appendMovement(
    authClient: any,
    spreadsheetId: string,
    movementRequest: IMovementRequest
  ): Promise<any> {
    // Genera movementId se non presente
    const movementId = movementRequest.movementId || this.generateMovementId();

    // Crea transactions dal movimento
    const transactions: ITransaction[] = movementRequest.transactions?.map(
      (treq:any) => ({
        transactionId: treq.transactionId || this.generateTransactionId(),
        movementId: movementId,
        description: treq.description || movementRequest.description,
        category: treq.category || movementRequest.category,
        amount: treq.amount, // Il frontend invia già la stringa con il segno corretto
        date: treq.date || movementRequest.date,
        type:
          treq.type ||
          movementRequest.type ||
          this.normalizeType("", treq.amount),
        account: treq.account || "",
        notes: treq.notes || movementRequest.notes || "",
        location: treq.location || movementRequest.location || "",
        recurrenceId: movementRequest.recurrenceId || "",
        recurrencePattern: movementRequest.recurrencePattern || "",
        dateAdded: this.normalizeMetaDate(new Date()),
        dateModified: this.normalizeMetaDate(new Date()),
        status: movementRequest.status || "Confirmed",
      })
    );

    // Converte in righe e appende
    const values = transactions.map((t) => this.transactionToRowValidated(t));
    const body = { values };
    return await GoogleHelper.append(
      authClient,
      spreadsheetId,
      SHEET_RANGE,
      body
    );
  }

  // LIST movements (raggruppa transactions per movementId)
  public static async listMovements(
    authClient: any,
    spreadsheetId: string
  ): Promise<IMovement[]> {
    const transactions: ITransaction[] = await this.listTransactions(
      authClient,
      spreadsheetId
    );

    // Raggruppa per movementId
    return this.groupTransactionsByMovement(transactions);
  }

  public static async listTransactions(
    authClient: any,
    spreadsheetId: string,
    filters?: ITransactionFilters
  ): Promise<ITransaction[]> {
    const rows: any[][] = await GoogleHelper.get(
      authClient,
      spreadsheetId,
      SHEET_RANGE
    );
    if (!rows || rows.length === 0) return [];

    // Converte tutte le righe in transactions
    let transactions: ITransaction[] = [];
    rows.forEach((r, i) => {
      const p = this.rowToTransaction(r, i);
      if (p && p.transaction.status !== "DELETED") {
        transactions.push(p.transaction);
      }
    });

    // Apply filters if provided
    if (filters) {
      transactions = this.applyFilters(transactions, filters);
    }

    return transactions;
  }

  // Apply filters to transactions in-memory
  private static applyFilters(
    transactions: ITransaction[],
    filters: ITransactionFilters
  ): ITransaction[] {
    let filtered = [...transactions];

    // Filter by date range
    if (filters.from_date) {
      const fromDate = this.parseDateForFilter(filters.from_date);
      if (fromDate) {
        filtered = filtered.filter((t) => {
          const tDate = this.parseDateForFilter(t.date);
          return tDate && tDate >= fromDate;
        });
      }
    }

    if (filters.to_date) {
      const toDate = this.parseDateForFilter(filters.to_date);
      if (toDate) {
        filtered = filtered.filter((t) => {
          const tDate = this.parseDateForFilter(t.date);
          return tDate && tDate <= toDate;
        });
      }
    }

    // Filter by account
    if (filters.account) {
      filtered = filtered.filter((t) => t.account === filters.account);
    }

    // Filter by category
    if (filters.category) {
      filtered = filtered.filter((t) => t.category === filters.category);
    }

    // Filter by type
    if (filters.type) {
      filtered = filtered.filter((t) => t.type === filters.type);
    }

    // Filter by status
    if (filters.status) {
      filtered = filtered.filter((t) => t.status === filters.status);
    }

    // Apply offset
    if (filters.offset && filters.offset > 0) {
      filtered = filtered.slice(filters.offset);
    }

    // Apply limit only if explicitly provided (for backward compatibility)
    if (filters.limit !== undefined) {
      const limit = Math.min(filters.limit, 1000);
      if (limit > 0) {
        filtered = filtered.slice(0, limit);
      }
    }

    return filtered;
  }

  // Parse date string in dd-MM-yyyy format to Date object for filtering
  private static parseDateForFilter(dateStr: string): Date | null {
    if (!dateStr) return null;
    
    // Handle dd-MM-yyyy format
    const match = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (match) {
      const [, day, month, year] = match;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    
    return null;
  }

  // GET movimento per movementId
  public static async getMovement(
    authClient: any,
    spreadsheetId: string,
    movementId: string
  ): Promise<IMovement | null> {
    const rows: any[][] = await GoogleHelper.get(
      authClient,
      spreadsheetId,
      SHEET_RANGE
    );
    if (!rows) return null;

    // Trova tutte le transactions con questo movementId
    const transactions: ITransaction[] = [];
    rows.forEach((r, i) => {
      if (r[COLS.MOVEMENT_ID] === movementId) {
        const p = this.rowToTransaction(r, i);
        if (p && p.transaction.status !== "DELETED") {
          transactions.push(p.transaction);
        }
      }
    });

    if (transactions.length === 0) return null;

    // Crea movimento dalle transactions
    const movements = this.groupTransactionsByMovement(transactions);
    return movements.length > 0 ? movements[0] : null;
  }

  // UPDATE movimento completo (gestisce create/update/delete di transactions)
  public static async updateMovement(
    authClientClient: any,
    spreadsheetId: string,
    movementRequest: IMovementRequest
  ): Promise<any> {
    const movementId = movementRequest.movementId;
    if (!movementId) throw new Error("MovementId richiesto per update");

    const rows: any[][] = await GoogleHelper.get(
      authClientClient,
      spreadsheetId,
      SHEET_RANGE
    );
    if (!rows) throw new Error("Foglio vuoto");

    // Trova tutte le transactions esistenti per questo movimento
    const existingTransactionRows = new Map<
      string,
      { row: any[]; index: number }
    >();
    rows.forEach((r, i) => {
      if (
        r[COLS.MOVEMENT_ID] === movementId &&
        r[COLS.TRANSACTION_ID] &&
        r[COLS.STATUS] !== "DELETED"
      ) {
        existingTransactionRows.set(r[COLS.TRANSACTION_ID], {
          row: r,
          index: i,
        });
      }
    });

    const updateData: IUpdateTransactionBodyData[] = [];
    const newTransactions: ITransaction[] = [];

    // PRIMA: Soft delete di tutte le transactions esistenti
    existingTransactionRows.forEach((existing, transactionId) => {
      const row = [...existing.row];
      row[COLS.STATUS] = "DELETED";
      row[COLS.DATE_DELETED] = this.normalizeMetaDate(new Date());
      row[COLS.DATE_MODIFIED] = this.normalizeMetaDate(new Date());

      // +2 because: data is fetched from A2:Z (row 2 onwards), so index 0 = row 2
      const rowNumber = existing.index + 2;
      const range = `${SHEET_NAME}!A${rowNumber}:Z${rowNumber}`;
      updateData.push({
        majorDimension: "ROWS",
        range: range,
        values: [row],
      });
    });

    // SECONDA: Crea tutte le nuove transactions
    for (const treq of movementRequest.transactions || []) {
      const transaction: ITransaction = {
        transactionId: this.generateTransactionId(),
        movementId: movementId,
        description: treq.description || movementRequest.description,
        category: treq.category || movementRequest.category,
        amount: treq.amount,
        date: treq.date || movementRequest.date,
        type:
          treq.type ||
          movementRequest.type ||
          this.normalizeType("", treq.amount),
        account: treq.account || "",
        notes: treq.notes || movementRequest.notes || "",
        location: treq.location || movementRequest.location || "",
        recurrenceId: movementRequest.recurrenceId || "",
        recurrencePattern: movementRequest.recurrencePattern || "",
        dateAdded: this.normalizeMetaDate(new Date()),
        dateModified: this.normalizeMetaDate(new Date()),
        status: movementRequest.status || "Confirmed",
      };
      newTransactions.push(transaction);
    }

    // Esegui updates
    const results: any[] = [];
    if (updateData.length > 0) {
      results.push(
        await GoogleHelper.update(authClientClient, spreadsheetId, updateData)
      );
    }

    // Appendi nuove transactions
    if (newTransactions.length > 0) {
      const values = newTransactions.map((t) =>
        this.transactionToRowValidated(t)
      );
      const body = { values };
      results.push(
        await GoogleHelper.append(
          authClientClient,
          spreadsheetId,
          SHEET_RANGE,
          body
        )
      );
    }

    return results;
  }

  // DELETE (soft delete: status = DELETED + dateDeleted per tutte le transactions)
  public static async deleteMovement(
    authClient: any,
    spreadsheetId: string,
    movementId: string
  ): Promise<any> {
    const rows: any[][] = await GoogleHelper.get(
      authClient,
      spreadsheetId,
      SHEET_RANGE
    );
    if (!rows) throw new Error("Foglio vuoto");

    const updateData: IUpdateTransactionBodyData[] = [];
    const now = this.normalizeMetaDate(new Date());

    // Trova tutte le transactions con questo movementId e marcale come DELETED
    rows.forEach((r, i) => {
      if (r[COLS.MOVEMENT_ID] === movementId && r[COLS.STATUS] !== "DELETED") {
        const row = [...r];
        row[COLS.STATUS] = "DELETED";
        row[COLS.DATE_DELETED] = now;
        row[COLS.DATE_MODIFIED] = now;

        // +2 because: data is fetched from A2:Z (row 2 onwards), so index 0 = row 2
        const rowNumber = i + 2;
        const range = `${SHEET_NAME}!A${rowNumber}:Z${rowNumber}`;
        updateData.push({
          majorDimension: "ROWS",
          range: range,
          values: [row],
        });
      }
    });

    if (updateData.length === 0) {
      throw new Error("Movement non trovato o già eliminato");
    }

    return await GoogleHelper.update(authClient, spreadsheetId, updateData);
  }

  // Utility: genera un movementId univoco
  private static generateMovementId(): string {
    return `mov${Date.now()}${Math.floor(Math.random() * 1000)}`;
  }

  // Utility: genera un transactionId univoco
  private static generateTransactionId(): string {
    return `tx${Date.now()}${Math.floor(Math.random() * 1000)}`;
  }

  // Helper interno che converte dati già normalizzati in riga
  private static transactionToRowValidated(t: ITransaction): any[] {
    // Build row based on COLS mapping
    const row: any[] = new Array(16).fill(""); // 16 colonne
    row[COLS.DESCRIPTION] = t.description;
    row[COLS.CATEGORY] = t.category;
    row[COLS.AMOUNT] = t.amount; // Il frontend invia già la stringa con il segno corretto
    row[COLS.DATE] = t.date;
    row[COLS.TYPE] = t.type;
    row[COLS.ACCOUNT] = t.account;
    row[COLS.TRANSACTION_ID] = t.transactionId;
    row[COLS.MOVEMENT_ID] = t.movementId;
    row[COLS.NOTES] = t.notes;
    row[COLS.LOCATION] = t.location;
    row[COLS.RECURRENCE_ID] = t.recurrenceId;
    row[COLS.DATE_ADDED] = t.dateAdded;
    row[COLS.DATE_MODIFIED] = t.dateModified;
    row[COLS.DATE_DELETED] = t.dateDeleted || "";
    row[COLS.STATUS] = t.status;
    row[COLS.RECURRENCE_PATTERN] = t.recurrencePattern || "";
    return row;
  }

  // =================
  // UTILITY METHODS
  // =================

  /**
   * Aggiorna il nome dell'account in tutte le transazioni che lo contengono
   */
  public static async updateTransactionsAccountName(
    authClient: any,
    spreadsheetId: string,
    oldAccountName: string,
    newAccountName: string
  ): Promise<number> {
    const rows: any[][] = await GoogleHelper.get(
      authClient,
      spreadsheetId,
      SHEET_RANGE
    );
    if (!rows || rows.length === 0) return 0;

    const updateData: IUpdateTransactionBodyData[] = [];
    const now = this.normalizeMetaDate(new Date());

    // Trova tutte le transazioni con il vecchio nome account
    rows.forEach((r, i) => {
      if (r[COLS.ACCOUNT] === oldAccountName && r[COLS.STATUS] !== "DELETED") {
        const row = [...r];
        row[COLS.ACCOUNT] = newAccountName;
        row[COLS.DATE_MODIFIED] = now;

        // +2 because: data is fetched from A2:Z (row 2 onwards), so index 0 = row 2
        const rowNumber = i + 2;
        const range = `${SHEET_NAME}!A${rowNumber}:Z${rowNumber}`;
        updateData.push({
          majorDimension: "ROWS",
          range: range,
          values: [row],
        });
      }
    });

    if (updateData.length === 0) {
      return 0;
    }

    await GoogleHelper.update(authClient, spreadsheetId, updateData);
    return updateData.length;
  }

  /**
   * Estrae il numero di riga da un range di Google Sheets
   */
  private static extractRowNumberFromRange(range: string): string {
    const match = range.match(/(\d+)$/);
    return match ? match[1] : "1";
  }

  /**
   * GET /transactions/delta - Returns transactions modified since a specific timestamp
   * @param authClient - Google auth client
   * @param spreadsheetId - The spreadsheet ID
   * @param since - ISO timestamp string (e.g., "2024-12-01T10:30:00")
   * @returns Transactions modified after the given timestamp
   */
  public static async listTransactionsDelta(
    authClient: any,
    spreadsheetId: string,
    since: string
  ): Promise<ITransaction[]> {
    const rows: any[][] = await GoogleHelper.get(
      authClient,
      spreadsheetId,
      SHEET_RANGE
    );
    if (!rows || rows.length === 0) return [];

    // Parse the since parameter
    const sinceDate = new Date(since);
    if (isNaN(sinceDate.getTime())) {
      throw new Error(
        "Invalid 'since' parameter. Expected ISO timestamp format (e.g., '2024-12-01T10:30:00' or '2024-12-01T10:30:00Z')."
      );
    }

    // Convert all rows to transactions and filter by dateModified
    const transactions: ITransaction[] = [];
    rows.forEach((r, i) => {
      const p = this.rowToTransaction(r, i);
      if (p && p.transaction.status !== "DELETED") {
        // Parse dateModified (format: yyyy-MM-dd HH:mm)
        const dateModified = this.parseMetaDateToDate(p.transaction.dateModified);
        if (dateModified && dateModified > sinceDate) {
          transactions.push(p.transaction);
        }
      }
    });

    return transactions;
  }

  /**
   * Parse meta date string (yyyy-MM-dd HH:mm) to Date object
   */
  private static parseMetaDateToDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    
    // Handle yyyy-MM-dd HH:mm format
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);
    if (match) {
      const [, year, month, day, hour, minute] = match;
      return new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute)
      );
    }
    
    return null;
  }
}
