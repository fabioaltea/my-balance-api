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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShortcutController = void 0;
const DbHelper_1 = require("../helpers/DbHelper");
const TransactionsHelper_1 = require("../helpers/MyBalance/TransactionsHelper");
const AccountsHelper_1 = require("../helpers/MyBalance/AccountsHelper");
const GoogleAuthHelper_1 = require("../helpers/GoogleAuthHelper");
const crypto_1 = __importDefault(require("crypto"));
/**
 * ShortcutController
 * Handles iOS Shortcuts integration for quick movement creation
 * Uses shortcut key authentication instead of JWT
 */
class ShortcutController {
    /**
     * Generate a new shortcut key for the user
     */
    static generateShortcutKey(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userEmail = req.userId; // From auth middleware
                // Generate a secure random key (32 bytes = 64 hex chars)
                const shortcutKey = crypto_1.default.randomBytes(32).toString("hex");
                // Save to database
                yield DbHelper_1.DbHelper.updateShortcutKey(userEmail, shortcutKey);
                res.json({
                    success: true,
                    data: {
                        shortcutKey,
                    },
                });
            }
            catch (error) {
                console.error("Error generating shortcut key:", error);
                res.status(500).json({
                    success: false,
                    error: error.message || "Failed to generate shortcut key",
                });
            }
        });
    }
    /**
     * Get current shortcut key for the user
     */
    static getShortcutKey(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userEmail = req.userId; // From auth middleware
                const user = yield DbHelper_1.DbHelper.getUserByEmail(userEmail);
                if (!user) {
                    res.status(404).json({
                        success: false,
                        error: "User not found",
                    });
                    return;
                }
                res.json({
                    success: true,
                    data: {
                        shortcutKey: user.shortcut_key || null,
                    },
                });
            }
            catch (error) {
                console.error("Error fetching shortcut key:", error);
                res.status(500).json({
                    success: false,
                    error: error.message || "Failed to fetch shortcut key",
                });
            }
        });
    }
    /**
     * Create a movement via iOS Shortcut
     * Uses x-shortcutkey header for authentication
     */
    static createMovementViaShortcut(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const shortcutKey = req.headers["x-shortcutkey"];
                if (!shortcutKey) {
                    res.status(401).json({
                        success: false,
                        error: "Missing x-shortcutkey header",
                    });
                    return;
                }
                // Find user by shortcut key
                const user = yield DbHelper_1.DbHelper.getUserByShortcutKey(shortcutKey);
                if (!user) {
                    res.status(401).json({
                        success: false,
                        error: "Invalid shortcut key",
                    });
                    return;
                }
                const spreadsheetId = user.spreadsheet_id;
                if (!spreadsheetId) {
                    res.status(400).json({
                        success: false,
                        error: "User has no spreadsheet configured",
                    });
                    return;
                }
                // Extract movement data from request
                const { amount, description = "", category = "", account = "", location = "", date = new Date().toLocaleDateString("it-IT"), // dd-MM-yyyy format
                 } = req.body;
                if (!amount) {
                    res.status(400).json({
                        success: false,
                        error: "Amount is required",
                    });
                    return;
                }
                // Get session for this user to retrieve Google tokens
                const authClient = yield GoogleAuthHelper_1.GoogleAuthHelper.getAuthClientForUser(user.email, "ios");
                // Get user's accounts and find the best matching account
                const accounts = yield AccountsHelper_1.AccountsHelper.getAccounts(spreadsheetId, authClient);
                const matchedAccount = ShortcutController.findBestAccountMatch(account, accounts);
                console.log(`🔍 Account matching: input="${account}" -> matched="${matchedAccount}"`);
                // Create movement with "unconfirmed" status
                const movement = {
                    description,
                    category,
                    date,
                    location,
                    status: "unconfirmed", // Mark as unconfirmed for later review
                    transactions: [
                        {
                            amount: amount.toString(),
                            account: matchedAccount,
                            description,
                            category,
                            date,
                            location,
                            _operation: "create",
                        },
                    ],
                };
                // Save movement to Google Sheets using TransactionsHelper
                const result = yield TransactionsHelper_1.TransactionsHelper.appendMovement(authClient, spreadsheetId, movement);
                res.json({
                    success: true,
                    data: result,
                    message: "Movement created successfully via shortcut",
                });
            }
            catch (error) {
                console.error("Error creating movement via shortcut:", error);
                res.status(500).json({
                    success: false,
                    error: error.message || "Failed to create movement",
                });
            }
        });
    }
    /**
     * Find the best matching account name from user's accounts
     * Priority: exact match > partial match > first account (default)
     */
    static findBestAccountMatch(inputAccount, accounts) {
        if (!accounts.length)
            return "";
        if (!(inputAccount === null || inputAccount === void 0 ? void 0 : inputAccount.trim()))
            return accounts[0].name;
        const input = inputAccount.toLowerCase().trim();
        // 1. Exact match (case insensitive)
        const exactMatch = accounts.find((a) => a.name.toLowerCase() === input);
        if (exactMatch)
            return exactMatch.name;
        // 2. Partial match (input contains account name or vice versa)
        const partialMatch = accounts.find((a) => a.name.toLowerCase().includes(input) ||
            input.includes(a.name.toLowerCase()));
        if (partialMatch)
            return partialMatch.name;
        // 3. Fallback to first account (default)
        return accounts[0].name;
    }
}
exports.ShortcutController = ShortcutController;
//# sourceMappingURL=shortcut.controller.js.map