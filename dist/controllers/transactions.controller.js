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
                const authClient = yield google_1.GoogleAuthHelper.getAuthClientForUser(userEmail, deviceType);
                // Get spreadsheet ID - either from query or user's default
                let spreadsheetId = req.query.spreadsheet_id;
                if (!spreadsheetId) {
                    spreadsheetId = yield google_1.GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
                }
                if (!spreadsheetId) {
                    res.status(400).json({
                        success: false,
                        error: "Missing spreadsheet_id in query params and no default spreadsheet configured",
                    });
                    return;
                }
                console.log("🔄 Loading transactions for spreadsheet:", spreadsheetId);
                // Parse pagination parameters
                const page = parseInt(req.query.page) || 1;
                const limit = Math.min(parseInt(req.query.limit) || 100, 500); // Max 500 per page
                const startDate = req.query.startDate; // Format: dd-MM-yyyy
                const endDate = req.query.endDate; // Format: dd-MM-yyyy
                const sort = req.query.sort || "desc"; // "asc" or "desc"
                // Get all transactions using TransactionsHelper
                const allTransactions = yield mybalance_1.TransactionsHelper.listTransactions(authClient, spreadsheetId);
                // Apply date filtering if provided
                let filteredTransactions = allTransactions;
                if (startDate || endDate) {
                    filteredTransactions = mybalance_1.TransactionsHelper.filterTransactionsByDateRange(allTransactions, startDate, endDate);
                }
                // Sort transactions by date
                filteredTransactions.sort((a, b) => {
                    const dateA = mybalance_1.TransactionsHelper.parseDateToTimestamp(a.date);
                    const dateB = mybalance_1.TransactionsHelper.parseDateToTimestamp(b.date);
                    return sort === "desc" ? dateB - dateA : dateA - dateB;
                });
                // Calculate pagination
                const total = filteredTransactions.length;
                const totalPages = Math.ceil(total / limit);
                const startIndex = (page - 1) * limit;
                const endIndex = startIndex + limit;
                const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);
                console.log(`🔄 Transactions loaded: ${paginatedTransactions.length} of ${total} (page ${page}/${totalPages})`);
                res.json({
                    success: true,
                    data: paginatedTransactions,
                    pagination: {
                        page,
                        limit,
                        total,
                        totalPages,
                        hasMore: page < totalPages,
                    },
                });
            }
            catch (error) {
                if (handleGoogleTokenError(error, res, "getTransactions"))
                    return;
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
                const authClient = yield google_1.GoogleAuthHelper.getAuthClientForUser(userEmail, deviceType);
                // Get spreadsheet ID - either from query or user's default
                let spreadsheetId = req.query.spreadsheet_id;
                if (!spreadsheetId) {
                    spreadsheetId = yield google_1.GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
                }
                if (!spreadsheetId) {
                    res.status(400).json({
                        success: false,
                        error: "No spreadsheet ID provided and no default spreadsheet configured",
                    });
                    return;
                }
                // Create transaction using TransactionsHelper
                const result = yield mybalance_1.TransactionsHelper.appendMovement(authClient, spreadsheetId, transactionData);
                res.json({ success: true, data: result });
            }
            catch (error) {
                if (handleGoogleTokenError(error, res, "createTransaction"))
                    return;
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
                const authClient = yield google_1.GoogleAuthHelper.getAuthClientForUser(userEmail, deviceType);
                // Get spreadsheet ID - either from query or user's default
                let spreadsheetId = req.query.spreadsheet_id;
                if (!spreadsheetId) {
                    spreadsheetId = yield google_1.GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
                }
                if (!spreadsheetId) {
                    res.status(400).json({
                        success: false,
                        error: "No spreadsheet ID provided and no default spreadsheet configured",
                    });
                    return;
                }
                // Update transaction using TransactionsHelper
                const updatedTransaction = yield mybalance_1.TransactionsHelper.updateMovement(authClient, spreadsheetId, updateData);
                res.json({ success: true, data: updatedTransaction });
            }
            catch (error) {
                if (handleGoogleTokenError(error, res, "updateTransaction"))
                    return;
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
                const authClient = yield google_1.GoogleAuthHelper.getAuthClientForUser(userEmail, deviceType);
                // Get spreadsheet ID - either from query or user's default
                let spreadsheetId = req.query.spreadsheet_id;
                if (!spreadsheetId) {
                    spreadsheetId = yield google_1.GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
                }
                if (!spreadsheetId) {
                    res.status(400).json({
                        success: false,
                        error: "No spreadsheet ID provided and no default spreadsheet configured",
                    });
                    return;
                }
                // Delete transaction using TransactionsHelper
                yield mybalance_1.TransactionsHelper.deleteMovement(authClient, spreadsheetId, transactionId);
                res.json({ success: true, message: "Transaction deleted successfully" });
            }
            catch (error) {
                if (handleGoogleTokenError(error, res, "deleteTransaction"))
                    return;
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
                const authClient = yield google_1.GoogleAuthHelper.getAuthClientForUser(userEmail, deviceType);
                // Get spreadsheet ID - either from query or user's default
                let spreadsheetId = req.query.spreadsheet_id;
                if (!spreadsheetId) {
                    spreadsheetId = yield google_1.GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
                }
                if (!spreadsheetId) {
                    res.status(400).json({
                        success: false,
                        error: "No spreadsheet ID provided and no default spreadsheet configured",
                    });
                    return;
                }
                // Get transaction using TransactionsHelper
                const transaction = yield mybalance_1.TransactionsHelper.getMovement(authClient, spreadsheetId, transactionId);
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
                if (handleGoogleTokenError(error, res, "getTransaction"))
                    return;
                console.error("Error fetching transaction:", error);
                res.status(500).json({
                    error: "Failed to fetch transaction",
                    details: error.message,
                });
            }
        });
    }
    /**
     * GET /transactions/summary - Recupera sommario aggregato delle transazioni
     */
    static getTransactionsSummary(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log("🔄 GET /transactions/summary endpoint hit!");
                const userEmail = req.userId;
                // Get user's Google auth client
                const deviceType = req.deviceType || "web";
                const authClient = yield google_1.GoogleAuthHelper.getAuthClientForUser(userEmail, deviceType);
                // Get spreadsheet ID - either from query or user's default
                let spreadsheetId = req.query.spreadsheet_id;
                if (!spreadsheetId) {
                    spreadsheetId = yield google_1.GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
                }
                if (!spreadsheetId) {
                    res.status(400).json({
                        success: false,
                        error: "Missing spreadsheet_id in query params and no default spreadsheet configured",
                    });
                    return;
                }
                // Parse date range parameters
                const startDate = req.query.startDate; // Format: dd-MM-yyyy
                const endDate = req.query.endDate; // Format: dd-MM-yyyy
                // Get summary using TransactionsHelper
                const summary = yield mybalance_1.TransactionsHelper.getTransactionsSummary(authClient, spreadsheetId, startDate, endDate);
                res.json({ success: true, data: summary });
            }
            catch (error) {
                if (handleGoogleTokenError(error, res, "getTransactionsSummary"))
                    return;
                console.error("Error fetching transactions summary:", error);
                res.status(500).json({
                    success: false,
                    error: "Failed to fetch transactions summary",
                    details: error === null || error === void 0 ? void 0 : error.message,
                });
            }
        });
    }
}
exports.TransactionsController = TransactionsController;
//# sourceMappingURL=transactions.controller.js.map