"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountsHelper = void 0;
const google_1 = require("../google");
const transactions_helper_1 = require("./transactions.helper");
const SHEET_NAME = "Accounts";
const SHEET_RANGE = "Accounts!A2:Z";
// Mappatura colonne del foglio "Accounts" (0-based) — Schema v3
const COLS = {
    NAME: 0, // A: accountName
    COLOR: 1, // B: accountColor
    TEXT_COLOR: 2, // C: accountTxtColor
    IMAGE_URL: 3, // D: accountImgUrl
    DATE_ADDED: 4, // E: dateAdded
    DATE_MODIFIED: 5, // F: dateModified
};
class AccountsHelper {
    /**
     * Recupera tutti gli accounts dal sheet "Accounts"
     * @param spreadsheetId - The spreadsheet ID
     * @param authClient - Google auth client
     * @param calculateBalance - If true, calculates balance from transactions (default: true). If false, uses balance from sheet.
     */
    static getAccounts(spreadsheetId_1, authClient_1) {
        return __awaiter(this, arguments, void 0, function* (spreadsheetId, authClient, calculateBalance = true) {
            try {
                const auth = authClient;
                const rows = yield google_1.GoogleHelper.get(auth, spreadsheetId, SHEET_RANGE);
                if (!rows || rows.length === 0)
                    return [];
                let transactions = [];
                // Only fetch transactions if we need to calculate balance
                if (calculateBalance) {
                    console.log("📊 Fetching transactions to calculate account balances...");
                    transactions = yield transactions_helper_1.TransactionsHelper.listTransactions(auth, spreadsheetId);
                    console.log(`📊 Found ${transactions.length} transactions`);
                }
                else {
                    console.log("📊 Using balance from sheet (calculate_balance=false)");
                }
                const accounts = [];
                // Salta la prima riga se contiene headers
                const startIndex = rows[0] && rows[0][COLS.NAME] === "accountName" ? 1 : 0;
                for (let i = startIndex; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row || row.length === 0)
                        continue;
                    const account = this.rowToAccount(row, i);
                    if (account && !account.name.startsWith("DELETED_")) {
                        if (calculateBalance) {
                            // Calcola il balance reale per questo account
                            const calculatedBalance = this.calculateAccountBalance(account.name, transactions);
                            // Sostituisci il balance del sheet con quello calcolato
                            account.balance = this.formatBalance(calculatedBalance);
                        }
                        accounts.push(account);
                    }
                }
                console.log(`📊 Returning ${accounts.length} accounts`);
                return accounts;
            }
            catch (error) {
                console.error("Error getting accounts:", error);
                throw error;
            }
        });
    }
    /**
     * Crea nuovo account
     */
    static createAccount(spreadsheetId, authClient, accountData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const auth = authClient;
                const now = this.formatDateTime(new Date());
                const newRow = [
                    accountData.name, // A: accountName
                    accountData.color || "#808080", // B: accountColor
                    accountData.textColor || "#ffffff", // C: accountTxtColor
                    "", // D: accountImgUrl
                    now, // E: dateAdded
                    now, // F: dateModified
                ];
                const body = {
                    majorDimension: "ROWS",
                    range: SHEET_RANGE,
                    values: [newRow],
                };
                yield google_1.GoogleHelper.append(auth, spreadsheetId, SHEET_RANGE, body);
                return {
                    accountId: this.generateId(),
                    name: accountData.name,
                    description: accountData.description || "",
                    balance: this.formatBalance(accountData.balance || "0"),
                    color: accountData.color || "#808080",
                    textColor: accountData.textColor || "#ffffff",
                    status: "ACTIVE",
                    dateAdded: now,
                };
            }
            catch (error) {
                console.error("Error creating account:", error);
                throw error;
            }
        });
    }
    /**
     * Aggiorna account esistente
     */
    static updateAccount(spreadsheetId, authClient, accountId, updateData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const auth = authClient;
                // Prima trova l'account da aggiornare
                const rows = yield google_1.GoogleHelper.get(auth, spreadsheetId, SHEET_RANGE);
                if (!rows)
                    throw new Error("Sheet vuoto");
                let targetRowIndex = -1;
                let existingAccount = null;
                // Cerca l'account per nome (dato che non abbiamo accountId nel sheet legacy)
                for (let i = 0; i < rows.length; i++) {
                    const account = this.rowToAccount(rows[i], i);
                    if (account &&
                        (account.accountId === accountId || account.name === updateData.name)) {
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
                if (updateData.name)
                    updatedRow[COLS.NAME] = updateData.name;
                if (updateData.color)
                    updatedRow[COLS.COLOR] = updateData.color;
                if (updateData.textColor)
                    updatedRow[COLS.TEXT_COLOR] = updateData.textColor;
                updatedRow[COLS.DATE_MODIFIED] = this.formatDateTime(new Date());
                const rowNumber = targetRowIndex + 2; // +2: skip header row + 1-based
                const updateRange = `${SHEET_NAME}!A${rowNumber}:F${rowNumber}`;
                yield google_1.GoogleHelper.update(auth, spreadsheetId, [
                    { range: updateRange, values: [updatedRow] },
                ]);
                // Ritorna l'account aggiornato
                return Object.assign(Object.assign({}, existingAccount), { name: updateData.name || existingAccount.name, description: updateData.description || existingAccount.description, balance: updateData.balance
                        ? this.formatBalance(updateData.balance)
                        : existingAccount.balance, color: updateData.color || existingAccount.color, textColor: updateData.textColor || existingAccount.textColor });
            }
            catch (error) {
                console.error("Error updating account:", error);
                throw error;
            }
        });
    }
    /**
     * Elimina account (soft delete) - nasconde l'account impostando il nome vuoto
     */
    static deleteAccount(spreadsheetId, authClient, accountId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const auth = authClient;
                // Prima trova l'account da eliminare
                const rows = yield google_1.GoogleHelper.get(auth, spreadsheetId, SHEET_RANGE);
                if (!rows)
                    throw new Error("Sheet vuoto");
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
                yield google_1.GoogleHelper.update(auth, spreadsheetId, updateBody);
            }
            catch (error) {
                console.error("Error deleting account:", error);
                throw error;
            }
        });
    }
    /**
     * Crea multipli accounts in batch
     */
    static createAccountsBatch(spreadsheetId, authClient, accounts) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const auth = authClient;
                const now = this.formatDateTime(new Date());
                const newRows = [];
                const resultAccounts = [];
                for (const accountData of accounts) {
                    newRows.push([
                        accountData.name, // A: accountName
                        accountData.color || "#808080", // B: accountColor
                        accountData.textColor || "#ffffff", // C: accountTxtColor
                        "", // D: accountImgUrl
                        now, // E: dateAdded
                        now, // F: dateModified
                    ]);
                    resultAccounts.push({
                        accountId: this.generateId(),
                        name: accountData.name,
                        description: accountData.description || "",
                        balance: this.formatBalance(accountData.balance || "0"),
                        color: accountData.color || "#808080",
                        textColor: accountData.textColor || "#ffffff",
                        status: "ACTIVE",
                        dateAdded: now,
                    });
                }
                const body = {
                    majorDimension: "ROWS",
                    range: SHEET_RANGE,
                    values: newRows,
                };
                yield google_1.GoogleHelper.append(auth, spreadsheetId, SHEET_RANGE, body);
                return resultAccounts;
            }
            catch (error) {
                console.error("Error creating accounts batch:", error);
                throw error;
            }
        });
    }
    // =================
    // UTILITY METHODS
    // =================
    /**
     * Calcola il balance reale di un account sommando tutte le sue transazioni
     */
    static calculateAccountBalance(accountName, transactions) {
        var _a;
        let totalBalance = 0;
        for (const transaction of transactions) {
            // Skip transazioni con status "recurrent" (template) o "unconfirmed" (non ancora confermate)
            const status = (_a = transaction.status) === null || _a === void 0 ? void 0 : _a.toLowerCase();
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
        return totalBalance;
    }
    /**
     * Converte un amount da stringa (formato italiano con €) a numero
     */
    static parseAmount(amountStr) {
        if (typeof amountStr === "number")
            return amountStr;
        if (!amountStr)
            return 0;
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
            }
            else {
                // Formato US: "," migliaia, "." decimali
                raw = raw.replace(/,/g, "");
            }
        }
        else if (hasComma && !hasDot) {
            // Solo virgola -> decimale
            raw = raw.replace(/,/g, ".");
        }
        else if (hasDot && !hasComma) {
            // Solo punto -> decimale, rimuovi eventuali spazi già tolti
            // Nessuna azione necessaria
        }
        const parsed = parseFloat(raw.replace(/[^0-9.\-]/g, ""));
        return isNaN(parsed) ? 0 : parsed;
    }
    /**
     * Converte una riga del foglio in un oggetto IAccount
     */
    static rowToAccount(row, rowIndex) {
        try {
            if (!row || row.length === 0)
                return null;
            const name = row[COLS.NAME] ? String(row[COLS.NAME]).trim() : "";
            if (!name || name === "accountName")
                return null; // Skip header or empty
            return {
                accountId: `acc_${rowIndex}_${name.replace(/\s+/g, "_")}`,
                name: name,
                description: "",
                balance: "€ 0,00", // Balance calcolato dalle transazioni, non dal sheet
                color: row[COLS.COLOR] || "#808080",
                textColor: row[COLS.TEXT_COLOR] || "#ffffff",
                status: "ACTIVE",
                dateAdded: row[COLS.DATE_ADDED] || "",
            };
        }
        catch (error) {
            console.error("Error parsing account row:", error);
            return null;
        }
    }
    /**
     * Formatta il balance in formato valuta italiana
     */
    static formatBalance(balance) {
        if (balance === null || balance === undefined || balance === "") {
            return "€ 0,00";
        }
        const num = this.parseAmount(balance);
        if (isNaN(num))
            return "€ 0,00";
        return `€ ${num.toFixed(2).replace(".", ",")}`;
    }
    static generateId() {
        return "acc_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    }
    static formatDateTime(date) {
        return `${date.getDate().toString().padStart(2, "0")}-${(date.getMonth() + 1)
            .toString()
            .padStart(2, "0")}-${date.getFullYear()} ${date
            .getHours()
            .toString()
            .padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
    }
}
exports.AccountsHelper = AccountsHelper;
//# sourceMappingURL=accounts.helper.js.map