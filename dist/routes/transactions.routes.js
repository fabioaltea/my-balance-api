"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.transactionsRoutes = void 0;
const express_1 = require("express");
const transactions_controller_1 = require("../controllers/transactions.controller");
const requireAuth_middleware_1 = require("../middleware/requireAuth.middleware");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const transactionsRoutes = (0, express_1.Router)();
exports.transactionsRoutes = transactionsRoutes;
// Rate limiting for transactions endpoints
const transactionsRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 50, // Limit each IP to 50 requests per minute
    message: {
        success: false,
        error: "Too many requests, please try again later",
        code: "RATE_LIMIT_EXCEEDED",
    },
    standardHeaders: true,
    legacyHeaders: false,
});
// All transactions routes require authentication
console.log("🔧 Setting up TRANSACTIONS routes...");
/**
 * GET /transactions/summary - Recupera sommario aggregato delle transazioni
 */
transactionsRoutes.get("/summary", transactionsRateLimit, requireAuth_middleware_1.RequireAuthMiddleware.verify, transactions_controller_1.TransactionsController.getTransactionsSummary);
/**
 * GET /transactions - Restituisce tutte le transazioni
 */
console.log("🔧 Defining GET /transactions route...");
transactionsRoutes.get("/", transactionsRateLimit, (req, res, next) => {
    console.log("🔧 GET /transactions route hit - before auth middleware");
    next();
}, requireAuth_middleware_1.RequireAuthMiddleware.verify, transactions_controller_1.TransactionsController.getTransactions);
/**
 * POST /transactions - Crea nuova transazione
 */
transactionsRoutes.post("/", transactionsRateLimit, requireAuth_middleware_1.RequireAuthMiddleware.verify, transactions_controller_1.TransactionsController.createTransaction);
/**
 * GET /transactions/:transactionId - Recupera singola transazione
 */
transactionsRoutes.get("/:transactionId", transactionsRateLimit, requireAuth_middleware_1.RequireAuthMiddleware.verify, transactions_controller_1.TransactionsController.getTransaction);
/**
 * PUT /transactions/:transactionId - Aggiorna transazione esistente
 */
transactionsRoutes.put("/:transactionId", transactionsRateLimit, requireAuth_middleware_1.RequireAuthMiddleware.verify, transactions_controller_1.TransactionsController.updateTransaction);
/**
 * DELETE /transactions/:transactionId - Elimina transazione
 */
transactionsRoutes.delete("/:transactionId", transactionsRateLimit, requireAuth_middleware_1.RequireAuthMiddleware.verify, transactions_controller_1.TransactionsController.deleteTransaction);
//# sourceMappingURL=transactions.routes.js.map