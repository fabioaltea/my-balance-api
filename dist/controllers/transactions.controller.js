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
exports.TransactionsController = void 0;
const TransactionsHelper_1 = require("../helpers/MyBalance/TransactionsHelper");
const GoogleAuthHelper_1 = require("../helpers/GoogleAuthHelper");
class TransactionsController {
    /**
     * GET /transactions - Restituisce tutte le transazioni
     */
    static getTransactions(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log("🔄 =============");
                console.log("🔄 GET /transactions endpoint hit!");
                console.log("🔄 User ID:", req.userId);
                console.log("🔄 Device Type:", req.deviceType);
                console.log("🔄 Query params:", req.query);
                console.log("🔄 =============");
                const userEmail = req.userId;
                // Get user's Google auth client
                const deviceType = req.deviceType || "web";
                const authClient = yield GoogleAuthHelper_1.GoogleAuthHelper.getAuthClientForUser(userEmail, deviceType);
                // Get spreadsheet ID - either from query or user's default
                let spreadsheetId = req.query.spreadsheet_id;
                if (!spreadsheetId) {
                    spreadsheetId = yield GoogleAuthHelper_1.GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
                }
                if (!spreadsheetId) {
                    res.status(400).json({
                        success: false,
                        error: "Missing spreadsheet_id in query params and no default spreadsheet configured",
                    });
                    return;
                }
                console.log("🔄 Loading transactions for spreadsheet:", spreadsheetId);
                // Get all transactions using TransactionsHelper
                const allTransactions = yield TransactionsHelper_1.TransactionsHelper.listTransactions(authClient, spreadsheetId);
                console.log("🔄 Transactions loaded successfully:", allTransactions.length);
                res.json({ success: true, data: allTransactions });
            }
            catch (error) {
                console.error("❌ Error fetching transactions:", error);
                res.status(500).json({
                    success: false,
                    error: "Failed to fetch transactions",
                    details: error === null || error === void 0 ? void 0 : error.message,
                });
            }
        });
    }
    /**
     * POST /transactions - Crea nuova transazione
     */
    static createTransaction(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userEmail = req.userId;
                const transactionData = req.body;
                // Get user's Google auth client
                const deviceType = req.deviceType || "web";
                const authClient = yield GoogleAuthHelper_1.GoogleAuthHelper.getAuthClientForUser(userEmail, deviceType);
                // Get spreadsheet ID - either from query or user's default
                let spreadsheetId = req.query.spreadsheet_id;
                if (!spreadsheetId) {
                    spreadsheetId = yield GoogleAuthHelper_1.GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
                }
                if (!spreadsheetId) {
                    res.status(400).json({
                        success: false,
                        error: "No spreadsheet ID provided and no default spreadsheet configured",
                    });
                    return;
                }
                // Create transaction using TransactionsHelper
                const result = yield TransactionsHelper_1.TransactionsHelper.appendMovement(authClient, spreadsheetId, transactionData);
                res.json({ success: true, data: result });
            }
            catch (error) {
                console.error("Error creating transaction:", error);
                res.status(500).json({
                    error: "Failed to create transaction",
                    details: error.message,
                });
            }
        });
    }
    /**
     * PUT /transactions/:transactionId - Aggiorna transazione esistente
     */
    static updateTransaction(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userEmail = req.userId;
                const { transactionId } = req.params;
                const updateData = req.body;
                // Get user's Google auth client
                const deviceType = req.deviceType || "web";
                const authClient = yield GoogleAuthHelper_1.GoogleAuthHelper.getAuthClientForUser(userEmail, deviceType);
                // Get spreadsheet ID - either from query or user's default
                let spreadsheetId = req.query.spreadsheet_id;
                if (!spreadsheetId) {
                    spreadsheetId = yield GoogleAuthHelper_1.GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
                }
                if (!spreadsheetId) {
                    res.status(400).json({
                        success: false,
                        error: "No spreadsheet ID provided and no default spreadsheet configured",
                    });
                    return;
                }
                // Update transaction using TransactionsHelper
                const updatedTransaction = yield TransactionsHelper_1.TransactionsHelper.updateMovement(authClient, spreadsheetId, updateData);
                res.json({ success: true, data: updatedTransaction });
            }
            catch (error) {
                console.error("Error updating transaction:", error);
                res.status(500).json({
                    error: "Failed to update transaction",
                    details: error.message,
                });
            }
        });
    }
    /**
     * DELETE /transactions/:transactionId - Elimina transazione
     */
    static deleteTransaction(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userEmail = req.userId;
                const { transactionId } = req.params;
                // Get user's Google auth client
                const deviceType = req.deviceType || "web";
                const authClient = yield GoogleAuthHelper_1.GoogleAuthHelper.getAuthClientForUser(userEmail, deviceType);
                // Get spreadsheet ID - either from query or user's default
                let spreadsheetId = req.query.spreadsheet_id;
                if (!spreadsheetId) {
                    spreadsheetId = yield GoogleAuthHelper_1.GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
                }
                if (!spreadsheetId) {
                    res.status(400).json({
                        success: false,
                        error: "No spreadsheet ID provided and no default spreadsheet configured",
                    });
                    return;
                }
                // Delete transaction using TransactionsHelper
                yield TransactionsHelper_1.TransactionsHelper.deleteMovement(authClient, spreadsheetId, transactionId);
                res.json({ success: true, message: "Transaction deleted successfully" });
            }
            catch (error) {
                console.error("Error deleting transaction:", error);
                res.status(500).json({
                    error: "Failed to delete transaction",
                    details: error.message,
                });
            }
        });
    }
    /**
     * GET /transactions/:transactionId - Recupera singola transazione
     */
    static getTransaction(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userEmail = req.userId;
                const { transactionId } = req.params;
                // Get user's Google auth client
                const deviceType = req.deviceType || "web";
                const authClient = yield GoogleAuthHelper_1.GoogleAuthHelper.getAuthClientForUser(userEmail, deviceType);
                // Get spreadsheet ID - either from query or user's default
                let spreadsheetId = req.query.spreadsheet_id;
                if (!spreadsheetId) {
                    spreadsheetId = yield GoogleAuthHelper_1.GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
                }
                if (!spreadsheetId) {
                    res.status(400).json({
                        success: false,
                        error: "No spreadsheet ID provided and no default spreadsheet configured",
                    });
                    return;
                }
                // Get transaction using TransactionsHelper
                const transaction = yield TransactionsHelper_1.TransactionsHelper.getMovement(authClient, spreadsheetId, transactionId);
                if (!transaction) {
                    res.status(404).json({
                        success: false,
                        error: "Transaction not found",
                    });
                    return;
                }
                res.json({ success: true, data: transaction });
            }
            catch (error) {
                console.error("Error fetching transaction:", error);
                res.status(500).json({
                    error: "Failed to fetch transaction",
                    details: error.message,
                });
            }
        });
    }
}
exports.TransactionsController = TransactionsController;
//# sourceMappingURL=transactions.controller.js.map