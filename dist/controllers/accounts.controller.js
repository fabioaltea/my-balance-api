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
exports.AccountsController = void 0;
const mybalance_1 = require("../helpers/mybalance");
const google_1 = require("../helpers/google");
// Helper to handle Google token errors and return appropriate HTTP status
function handleGoogleTokenError(error, res, context) {
    if (error instanceof google_1.GoogleTokenError) {
        console.error(`❌ Google token error in ${context}:`, error.message, error.code);
        res.status(401).json({
            success: false,
            error: error.message,
            code: error.code,
            requiresReauth: true,
        });
        return true;
    }
    return false;
}
class AccountsController {
    /**
     * GET /accounts - Recupera tutti gli accounts
     */
    static getAccounts(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log("💰 =============");
                console.log("💰 GET /accounts endpoint hit!");
                console.log("💰 User ID:", req.userId);
                console.log("💰 Device Type:", req.deviceType);
                console.log("💰 Query params:", req.query);
                console.log("💰 =============");
                const userEmail = req.userId;
                // Get user's Google auth client with proper credentials
                const deviceType = req.deviceType || "web";
                // Get spreadsheet ID - either from query or user's default
                let spreadsheetId = req.query.spreadsheet_id;
                if (!spreadsheetId) {
                    spreadsheetId =
                        yield google_1.GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
                }
                if (!spreadsheetId) {
                    res.status(400).json({
                        success: false,
                        error: "No spreadsheet ID provided and no default spreadsheet configured",
                    });
                    return;
                }
                console.log("📊 Reading accounts from spreadsheet:", spreadsheetId);
                // Parse calculate_balance parameter (default: true for backward compatibility)
                const calculateBalance = req.query.calculate_balance !== "false";
                console.log("📊 Calculate balance:", calculateBalance);
                // Get all accounts using AccountsHelper
                const accounts = yield google_1.GoogleAuthHelper.executeWithRetry(userEmail, deviceType, (client) => __awaiter(this, void 0, void 0, function* () {
                    return mybalance_1.AccountsHelper.getAccounts(spreadsheetId, client, calculateBalance);
                }));
                console.log("💰 Accounts fetched successfully:", accounts.length);
                res.json({ success: true, data: accounts });
            }
            catch (error) {
                if (handleGoogleTokenError(error, res, "getAccounts"))
                    return;
                console.error("Error fetching accounts:", error);
                res.status(500).json({
                    error: "Failed to fetch accounts",
                    details: error === null || error === void 0 ? void 0 : error.message,
                });
            }
        });
    }
    /**
     * POST /accounts - Crea nuovo account
     */
    static createAccount(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userEmail = req.userId;
                const { name, description, balance, color, textColor } = req.body;
                // Get user's Google auth client
                const deviceType = req.deviceType || "web";
                // Get spreadsheet ID - either from query or user's default
                let spreadsheetId = req.query.spreadsheet_id;
                if (!spreadsheetId) {
                    spreadsheetId =
                        yield google_1.GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
                }
                if (!spreadsheetId) {
                    res.status(400).json({
                        success: false,
                        error: "No spreadsheet ID provided and no default spreadsheet configured",
                    });
                    return;
                }
                // Create new account using AccountsHelper
                const account = yield google_1.GoogleAuthHelper.executeWithRetry(userEmail, deviceType, (client) => __awaiter(this, void 0, void 0, function* () {
                    // Get refresh token from auth client
                    const refreshToken = client.credentials.refresh_token;
                    if (!refreshToken) {
                        throw new Error("No refresh token found for user");
                    }
                    return mybalance_1.AccountsHelper.createAccount(spreadsheetId, refreshToken, {
                        name: name || "Unnamed Account",
                        description: description || "",
                        balance: balance || "0,00",
                        color: color || "#808080",
                        textColor: textColor || "#ffffff",
                    });
                }));
                res.json({ success: true, data: account });
            }
            catch (error) {
                if (handleGoogleTokenError(error, res, "createAccount"))
                    return;
                console.error("Error creating account:", error);
                res.status(500).json({
                    error: "Failed to create account",
                    details: error.message,
                });
            }
        });
    }
    /**
     * PUT /accounts/:accountId - Aggiorna account esistente
     */
    static updateAccount(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log("💰 =============");
                console.log("💰 PUT /accounts/:accountId endpoint hit!");
                console.log("💰 User ID:", req.userId);
                console.log("💰 Device Type:", req.deviceType);
                console.log("💰 Account ID:", req.params.accountId);
                console.log("💰 =============");
                const userEmail = req.userId;
                const { accountId } = req.params;
                const updateData = req.body;
                // Get user's Google auth client with proper credentials
                const deviceType = req.deviceType || "web";
                // Get spreadsheet ID - either from query or user's default
                let spreadsheetId = req.query.spreadsheet_id;
                if (!spreadsheetId) {
                    spreadsheetId =
                        yield google_1.GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
                }
                if (!spreadsheetId) {
                    res.status(400).json({
                        success: false,
                        error: "No spreadsheet ID provided and no default spreadsheet configured",
                    });
                    return;
                }
                console.log("📊 Updating account in spreadsheet:", spreadsheetId);
                // Se è prevista la modifica del nome, recupera prima l'account corrente
                let oldAccountName = null;
                if (updateData.name) {
                    const accounts = yield google_1.GoogleAuthHelper.executeWithRetry(userEmail, deviceType, (client) => __awaiter(this, void 0, void 0, function* () {
                        return mybalance_1.AccountsHelper.getAccounts(spreadsheetId, client);
                    }));
                    const currentAccount = accounts.find((acc) => acc.accountId === accountId);
                    if (currentAccount && currentAccount.name !== updateData.name) {
                        oldAccountName = currentAccount.name;
                        console.log(`📊 Account name change detected: "${oldAccountName}" -> "${updateData.name}"`);
                    }
                }
                // Update account using AccountsHelper
                const updatedAccount = yield google_1.GoogleAuthHelper.executeWithRetry(userEmail, deviceType, (client) => __awaiter(this, void 0, void 0, function* () {
                    // Get refresh token from auth client
                    const refreshToken = client.credentials.refresh_token;
                    if (!refreshToken) {
                        throw new Error("No refresh token found for user");
                    }
                    return mybalance_1.AccountsHelper.updateAccount(spreadsheetId, refreshToken, accountId, updateData);
                }));
                // Se il nome è cambiato, aggiorna tutte le transazioni con il nuovo nome
                if (oldAccountName && updateData.name) {
                    console.log(`📊 Updating transactions from account "${oldAccountName}" to "${updateData.name}"`);
                    const updatedCount = yield google_1.GoogleAuthHelper.executeWithRetry(userEmail, deviceType, (client) => __awaiter(this, void 0, void 0, function* () {
                        return mybalance_1.TransactionsHelper.updateTransactionsAccountName(client, spreadsheetId, oldAccountName, updateData.name);
                    }));
                    console.log(`📊 Updated ${updatedCount} transactions with new account name`);
                }
                console.log("💰 Account updated successfully:", updatedAccount.name);
                res.json({ success: true, data: updatedAccount });
            }
            catch (error) {
                if (handleGoogleTokenError(error, res, "updateAccount"))
                    return;
                console.error("Error updating account:", error);
                res.status(500).json({
                    error: "Failed to update account",
                    details: error.message,
                });
            }
        });
    }
    /**
     * DELETE /accounts/:accountId - Elimina account
     */
    static deleteAccount(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userEmail = req.userId;
                const { accountId } = req.params;
                // Get spreadsheet ID - either from query or user's default
                let spreadsheetId = req.query.spreadsheet_id;
                if (!spreadsheetId) {
                    spreadsheetId =
                        yield google_1.GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
                }
                if (!spreadsheetId) {
                    res.status(400).json({
                        success: false,
                        error: "No spreadsheet ID provided and no default spreadsheet configured",
                    });
                    return;
                }
                // Get user's Google auth client
                const deviceType = req.deviceType || "web";
                // Delete account using AccountsHelper
                yield google_1.GoogleAuthHelper.executeWithRetry(userEmail, deviceType, (client) => __awaiter(this, void 0, void 0, function* () {
                    // Get refresh token from auth client
                    const refreshToken = client.credentials.refresh_token;
                    if (!refreshToken) {
                        throw new Error("No refresh token found for user");
                    }
                    return mybalance_1.AccountsHelper.deleteAccount(spreadsheetId, refreshToken, accountId);
                }));
                res.json({ success: true, message: "Account deleted successfully" });
            }
            catch (error) {
                if (handleGoogleTokenError(error, res, "deleteAccount"))
                    return;
                console.error("Error deleting account:", error);
                res.status(500).json({
                    error: "Failed to delete account",
                    details: error.message,
                });
            }
        });
    }
    /**
     * POST /accounts/batch - Crea multipli accounts in batch
     */
    static createAccountsBatch(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userEmail = req.userId;
                const { accounts } = req.body;
                // Get spreadsheet ID - either from query or user's default
                let spreadsheetId = req.query.spreadsheet_id;
                if (!spreadsheetId) {
                    spreadsheetId =
                        yield google_1.GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
                }
                if (!spreadsheetId) {
                    res.status(400).json({
                        success: false,
                        error: "No spreadsheet ID provided and no default spreadsheet configured",
                    });
                    return;
                }
                // Get user's Google auth client
                const deviceType = req.deviceType || "web";
                // Create accounts batch using AccountsHelper
                const createdAccounts = yield google_1.GoogleAuthHelper.executeWithRetry(userEmail, deviceType, (client) => __awaiter(this, void 0, void 0, function* () {
                    // Get refresh token from auth client
                    const refreshToken = client.credentials.refresh_token;
                    if (!refreshToken) {
                        throw new Error("No refresh token found for user");
                    }
                    return mybalance_1.AccountsHelper.createAccountsBatch(spreadsheetId, refreshToken, accounts);
                }));
                res.json({ success: true, data: createdAccounts });
            }
            catch (error) {
                if (handleGoogleTokenError(error, res, "createAccountsBatch"))
                    return;
                console.error("Error creating accounts batch:", error);
                res.status(500).json({
                    error: "Failed to create accounts",
                    details: error.message,
                });
            }
        });
    }
}
exports.AccountsController = AccountsController;
//# sourceMappingURL=accounts.controller.js.map