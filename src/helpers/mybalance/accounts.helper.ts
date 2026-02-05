import { GoogleHelper } from "../google";
import { TransactionsHelper } from "./transactions.helper";
import { ITransaction, IAccount, IAccountData } from "../../models";

const SHEET_NAME = "Accounts";
const SHEET_RANGE = "Accounts!A2:Z";

// Mappatura colonne del foglio "Accounts" (0-based)
const COLS = {
  NAME: 0, // A: accountName
  START_BALANCE: 1, // B: accountStartBalance
  CURRENT_BALANCE: 2, // C: accountCurBalance (formula)
  COLOR: 3, // D: accountColor
  TEXT_COLOR: 4, // E: accountTxtColor
  IMAGE_URL: 5, // F: accountImgUrl
  IS_TOTAL: 6, // G: isTotal
} as const;

export class AccountsHelper {
  /**
   * Recupera tutti gli accounts dal sheet "Accounts"
   */
  static async getAccounts(
    spreadsheetId: string,
    authClient: any,
  ): Promise<IAccount[]> {
    try {
      const auth = authClient;
      const rows: any[][] = await GoogleHelper.get(
        auth,
        spreadsheetId,
        SHEET_RANGE,
      );

      if (!rows || rows.length === 0) return [];

      // Recupera anche tutte le transazioni per calcolare i balance reali
      console.log("📊 Fetching transactions to calculate account balances...");
      const transactions = await TransactionsHelper.listTransactions(
        auth,
        spreadsheetId,
      );
      console.log(`📊 Found ${transactions.length} transactions`);

      const accounts: IAccount[] = [];

      // Salta la prima riga se contiene headers
      const startIndex =
        rows[0] && rows[0][COLS.NAME] === "accountName" ? 1 : 0;

      for (let i = startIndex; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0 || row[COLS.IS_TOTAL] === "1") continue;

        const account = this.rowToAccount(row, i);
        if (account && !account.name.startsWith("DELETED_")) {
          // Calcola il balance reale per questo account
          const calculatedBalance = this.calculateAccountBalance(
            account.name,
            transactions,
          );

          // Sostituisci il balance del sheet con quello calcolato
          account.balance = this.formatBalance(calculatedBalance);

          console.log(
            `💰 Account "${account.name}": calculated balance = ${account.balance}`,
          );

          accounts.push(account);
        }
      }

      console.log(
        `📊 Returning ${accounts.length} accounts with calculated balances`,
      );
      return accounts;
    } catch (error) {
      console.error("Error getting accounts:", error);
      throw error;
    }
  }

  /**
   * Crea nuovo account
   */
  static async createAccount(
    spreadsheetId: string,
    refreshToken: string,
    accountData: IAccountData,
  ): Promise<IAccount> {
    try {
      const auth = { refresh_token: refreshToken };

      // Prima otteniamo il numero di righe per calcolare la posizione
      const currentRows = await GoogleHelper.get(
        auth,
        spreadsheetId,
        SHEET_RANGE,
      );
      const nextRowNum = (currentRows?.length || 0) + 1;

      // Prepara la riga da inserire seguendo la struttura del sheet
      const newRow = [
        accountData.name, // A: name
        "0", // B: start balance
        `=B${nextRowNum}+SOMMA.SE(AllTransactions!F:F;A${nextRowNum};AllTransactions!C:C)`, // C: formula per balance corrente
        accountData.color || "#808080", // D: color
        accountData.textColor || "#ffffff", // E: text color
        "", // F: image url (vuoto)
        "0", // G: is total (0 = false)
      ];

      const body = {
        majorDimension: "ROWS",
        range: SHEET_RANGE,
        values: [newRow],
      };

      const result = await GoogleHelper.append(
        auth,
        spreadsheetId,
        SHEET_RANGE,
        body,
      );

      // Crea l'oggetto account di risposta
      const newAccount: IAccount = {
        accountId: this.generateId(),
        name: accountData.name,
        description: accountData.description || "",
        balance: this.formatBalance(accountData.balance || "0"),
        color: accountData.color || "#808080",
        textColor: accountData.textColor || "#ffffff",
        status: "ACTIVE",
        dateAdded: this.formatDateTime(new Date()),
      };

      return newAccount;
    } catch (error) {
      console.error("Error creating account:", error);
      throw error;
    }
  }

  /**
   * Aggiorna account esistente
   */
  static async updateAccount(
    spreadsheetId: string,
    refreshToken: string,
    accountId: string,
    updateData: Partial<IAccountData>,
  ): Promise<IAccount> {
    try {
      const auth = { refresh_token: refreshToken };

      // Prima trova l'account da aggiornare
      const rows: any[][] = await GoogleHelper.get(
        auth,
        spreadsheetId,
        SHEET_RANGE,
      );
      if (!rows) throw new Error("Sheet vuoto");

      let targetRowIndex = -1;
      let existingAccount: IAccount | null = null;

      // Cerca l'account per nome (dato che non abbiamo accountId nel sheet legacy)
      for (let i = 0; i < rows.length; i++) {
        const account = this.rowToAccount(rows[i], i);
        if (
          account &&
          (account.accountId === accountId || account.name === updateData.name)
        ) {
          targetRowIndex = i;
          existingAccount = account;
          break;
        }
      }

      if (targetRowIndex === -1 || !existingAccount) {
        throw new Error(`Account con ID ${accountId} non trovato`);
      }

      // Prepara la riga aggiornata
      const updatedRow = [...rows[targetRowIndex]];
      if (updateData.name) updatedRow[COLS.NAME] = updateData.name;
      if (updateData.color) updatedRow[COLS.COLOR] = updateData.color;
      if (updateData.textColor)
        updatedRow[COLS.TEXT_COLOR] = updateData.textColor;

      // Aggiorna il balance solo se fornito (attenzione alle formule)
      if (updateData.balance) {
        updatedRow[COLS.START_BALANCE] = updateData.balance;
      }

      const rowNumber = targetRowIndex + 1; // 1-based per Google Sheets
      const updateRange = `${SHEET_NAME}!A${rowNumber}:Z${rowNumber}`;

      const updateBody = {
        majorDimension: "ROWS",
        range: updateRange,
        values: [updatedRow],
      };

      await GoogleHelper.update(auth, spreadsheetId, updateBody);

      // Ritorna l'account aggiornato
      return {
        ...existingAccount,
        name: updateData.name || existingAccount.name,
        description: updateData.description || existingAccount.description,
        balance: updateData.balance
          ? this.formatBalance(updateData.balance)
          : existingAccount.balance,
        color: updateData.color || existingAccount.color,
        textColor: updateData.textColor || existingAccount.textColor,
      };
    } catch (error) {
      console.error("Error updating account:", error);
      throw error;
    }
  }

  /**
   * Elimina account (soft delete) - nasconde l'account impostando il nome vuoto
   */
  static async deleteAccount(
    spreadsheetId: string,
    refreshToken: string,
    accountId: string,
  ): Promise<void> {
    try {
      const auth = { refresh_token: refreshToken };

      // Prima trova l'account da eliminare
      const rows: any[][] = await GoogleHelper.get(
        auth,
        spreadsheetId,
        SHEET_RANGE,
      );
      if (!rows) throw new Error("Sheet vuoto");

      let targetRowIndex = -1;

      // Cerca l'account per ID o nome
      for (let i = 0; i < rows.length; i++) {
        const account = this.rowToAccount(rows[i], i);
        if (account && account.accountId === accountId) {
          targetRowIndex = i;
          break;
        }
      }

      if (targetRowIndex === -1) {
        throw new Error(`Account con ID ${accountId} non trovato`);
      }

      // Nel sistema legacy, "eliminare" un account significa svuotarlo o marcarlo
      // Per ora lo nascondiamo impostando il nome a "DELETED_" + timestamp
      const updatedRow = [...rows[targetRowIndex]];
      updatedRow[COLS.NAME] = `DELETED_${Date.now()}_${updatedRow[COLS.NAME]}`;

      const rowNumber = targetRowIndex + 1; // 1-based per Google Sheets
      const updateRange = `${SHEET_NAME}!A${rowNumber}:Z${rowNumber}`;

      const updateBody = {
        majorDimension: "ROWS",
        range: updateRange,
        values: [updatedRow],
      };

      await GoogleHelper.update(auth, spreadsheetId, updateBody);
    } catch (error) {
      console.error("Error deleting account:", error);
      throw error;
    }
  }

  /**
   * Crea multipli accounts in batch
   */
  static async createAccountsBatch(
    spreadsheetId: string,
    refreshToken: string,
    accounts: IAccountData[],
  ): Promise<IAccount[]> {
    try {
      const auth = { refresh_token: refreshToken };

      // Prima otteniamo il numero di righe per calcolare la posizione
      const currentRows = await GoogleHelper.get(
        auth,
        spreadsheetId,
        SHEET_RANGE,
      );
      let nextRowNum = (currentRows?.length || 0) + 1;

      // Prepara tutte le righe da inserire
      const newRows: any[][] = [];
      const resultAccounts: IAccount[] = [];

      for (const accountData of accounts) {
        const newRow = [
          accountData.name, // A: name
          "0", // B: start balance
          `=B${nextRowNum}+SOMMA.SE(AllTransactions!F:F;A${nextRowNum};AllTransactions!C:C)`, // C: formula per balance corrente
          accountData.color || "#808080", // D: color
          accountData.textColor || "#ffffff", // E: text color
          "", // F: image url (vuoto)
          "0", // G: is total (0 = false)
        ];

        newRows.push(newRow);

        // Crea l'oggetto account di risposta
        resultAccounts.push({
          accountId: this.generateId(),
          name: accountData.name,
          description: accountData.description || "",
          balance: this.formatBalance(accountData.balance || "0"),
          color: accountData.color || "#808080",
          textColor: accountData.textColor || "#ffffff",
          status: "ACTIVE",
          dateAdded: this.formatDateTime(new Date()),
        });

        nextRowNum++; // Incrementa per la formula della prossima riga
      }

      // Esegue l'inserimento batch
      const body = {
        majorDimension: "ROWS",
        range: SHEET_RANGE,
        values: newRows,
      };

      await GoogleHelper.append(auth, spreadsheetId, SHEET_RANGE, body);

      return resultAccounts;
    } catch (error) {
      console.error("Error creating accounts batch:", error);
      throw error;
    }
  }

  // =================
  // UTILITY METHODS
  // =================

  /**
   * Recupera solo i balance degli accounts (ottimizzato - carica solo dati necessari)
   */
  static async getAccountBalances(
    spreadsheetId: string,
    authClient: any,
  ): Promise<Array<{ accountId: string; name: string; balance: string }>> {
    try {
      const auth = authClient;
      
      // Carica solo i nomi degli account
      const rows: any[][] = await GoogleHelper.get(
        auth,
        spreadsheetId,
        SHEET_RANGE,
      );

      if (!rows || rows.length === 0) return [];

      // Recupera le transazioni per calcolare i balance reali
      const transactions = await TransactionsHelper.listTransactions(
        auth,
        spreadsheetId,
      );

      const balances: Array<{ accountId: string; name: string; balance: string }> = [];

      // Salta la prima riga se contiene headers
      const startIndex =
        rows[0] && rows[0][COLS.NAME] === "accountName" ? 1 : 0;

      for (let i = startIndex; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0 || row[COLS.IS_TOTAL] === "1") continue;

        const name = row[COLS.NAME] ? String(row[COLS.NAME]).trim() : "";
        if (!name || name.startsWith("DELETED_")) continue;

        // Calcola il balance reale per questo account
        const calculatedBalance = this.calculateAccountBalance(
          name,
          transactions,
        );

        const accountId = `acc_${i}_${name.replace(/\s+/g, "_")}`;

        balances.push({
          accountId,
          name,
          balance: this.formatBalance(calculatedBalance),
        });
      }

      return balances;
    } catch (error) {
      console.error("Error getting account balances:", error);
      throw error;
    }
  }

  /**
   * Calcola il balance reale di un account sommando tutte le sue transazioni
   */
  private static calculateAccountBalance(
    accountName: string,
    transactions: ITransaction[],
  ): number {
    let totalBalance = 0;

    for (const transaction of transactions) {
      // Skip transazioni con status "recurrent" (template) o "unconfirmed" (non ancora confermate)
      const status = transaction.status?.toLowerCase();
      if (status === "recurrent" || status === "unconfirmed") {
        continue;
      }

      // Verifica se la transazione appartiene a questo account
      // Il campo account dovrebbe essere nella colonna 5 (ACCOUNT)
      if (transaction.account === accountName) {
        // Converti l'amount da stringa a numero
        const amount = this.parseAmount(transaction.amount);
        totalBalance += amount;
      }
    }

    console.log(
      `🧮 Final calculated balance for "${accountName}": ${totalBalance}`,
    );
    return totalBalance;
  }

  /**
   * Converte un amount da stringa (formato italiano con €) a numero
   */
  private static parseAmount(amountStr: string | number): number {
    if (typeof amountStr === "number") return amountStr;
    if (!amountStr) return 0;

    let raw = String(amountStr).trim();
    // Rimuovi simboli valuta e spazi
    raw = raw.replace(/[€\s]/g, "");

    const hasComma = raw.includes(",");
    const hasDot = raw.includes(".");

    if (hasComma && hasDot) {
      // Se ci sono entrambi, l'ultimo separatore visto è quello decimale
      const lastComma = raw.lastIndexOf(",");
      const lastDot = raw.lastIndexOf(".");
      if (lastComma > lastDot) {
        // Formato EU: "." migliaia, "," decimali
        raw = raw.replace(/\./g, "").replace(/,/g, ".");
      } else {
        // Formato US: "," migliaia, "." decimali
        raw = raw.replace(/,/g, "");
      }
    } else if (hasComma && !hasDot) {
      // Solo virgola -> decimale
      raw = raw.replace(/,/g, ".");
    } else if (hasDot && !hasComma) {
      // Solo punto -> decimale, rimuovi eventuali spazi già tolti
      // Nessuna azione necessaria
    }

    const parsed = parseFloat(raw.replace(/[^0-9.\-]/g, ""));
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Converte una riga del foglio in un oggetto IAccount
   */
  private static rowToAccount(row: any[], rowIndex: number): IAccount | null {
    try {
      if (!row || row.length === 0) return null;

      const name = row[COLS.NAME] ? String(row[COLS.NAME]).trim() : "";
      if (!name || name === "accountName") return null; // Skip header or empty

      return {
        accountId: `acc_${rowIndex}_${name.replace(/\s+/g, "_")}`,
        name: name,
        description: "", // Non abbiamo description nel sheet legacy
        balance: this.formatBalance(
          row[COLS.CURRENT_BALANCE] || row[COLS.START_BALANCE] || "0",
        ),
        color: row[COLS.COLOR] || "#808080",
        textColor: row[COLS.TEXT_COLOR] || "#ffffff",
        status: "ACTIVE", // Assumiamo tutti attivi
        dateAdded: this.formatDateTime(new Date()), // Non abbiamo data nel sheet legacy
      };
    } catch (error) {
      console.error("Error parsing account row:", error);
      return null;
    }
  }

  /**
   * Formatta il balance in formato valuta italiana
   */
  private static formatBalance(balance: any): string {
    if (balance === null || balance === undefined || balance === "") {
      return "€ 0,00";
    }

    const num = this.parseAmount(balance);
    if (isNaN(num)) return "€ 0,00";
    return `€ ${num.toFixed(2).replace(".", ",")}`;
  }

  private static generateId(): string {
    return "acc_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
  }

  private static formatDateTime(date: Date): string {
    return `${date.getDate().toString().padStart(2, "0")}-${(
      date.getMonth() + 1
    )
      .toString()
      .padStart(2, "0")}-${date.getFullYear()} ${date
      .getHours()
      .toString()
      .padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
  }
}
