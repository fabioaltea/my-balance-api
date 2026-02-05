"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountsRoutes = void 0;
const express_1 = require("express");
const accounts_controller_1 = require("../controllers/accounts.controller");
const requireAuth_middleware_1 = require("../middleware/requireAuth.middleware");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const accountsRoutes = (0, express_1.Router)();
exports.accountsRoutes = accountsRoutes;
// Rate limiting for accounts endpoints
const accountsRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // Limit each IP to 30 requests per minute
    message: {
        success: false,
        error: "Too many requests, please try again later",
        code: "RATE_LIMIT_EXCEEDED",
    },
    standardHeaders: true,
    legacyHeaders: false,
});
// All accounts routes require authentication
console.log("🔧 Setting up ACCOUNTS routes...");
/**
 * GET /accounts/balances - Recupera solo i balance degli accounts (ottimizzato)
 */
console.log("🔧 Defining GET /accounts/balances route...");
accountsRoutes.get("/balances", accountsRateLimit, requireAuth_middleware_1.RequireAuthMiddleware.verify, accounts_controller_1.AccountsController.getAccountBalances);
/**
 * GET /accounts - Recupera tutti gli accounts
 */
console.log("🔧 Defining GET /accounts route...");
accountsRoutes.get("/", accountsRateLimit, requireAuth_middleware_1.RequireAuthMiddleware.verify, accounts_controller_1.AccountsController.getAccounts);
/**
 * POST /accounts - Crea nuovo account
 */
console.log("🔧 Defining POST /accounts route...");
accountsRoutes.post("/", accountsRateLimit, (req, res, next) => {
    console.log("🔧 POST /accounts route hit - before auth middleware");
    next();
}, requireAuth_middleware_1.RequireAuthMiddleware.verify, accounts_controller_1.AccountsController.createAccount);
/**
 * PUT /accounts/:accountId - Aggiorna account esistente
 */
accountsRoutes.put("/:accountId", accountsRateLimit, requireAuth_middleware_1.RequireAuthMiddleware.verify, accounts_controller_1.AccountsController.updateAccount);
/**
 * DELETE /accounts/:accountId - Elimina account
 */
accountsRoutes.delete("/:accountId", accountsRateLimit, requireAuth_middleware_1.RequireAuthMiddleware.verify, accounts_controller_1.AccountsController.deleteAccount);
/**
 * POST /accounts/batch - Crea multipli accounts in batch
 */
accountsRoutes.post("/batch", accountsRateLimit, requireAuth_middleware_1.RequireAuthMiddleware.verify, accounts_controller_1.AccountsController.createAccountsBatch);
//# sourceMappingURL=accounts.routes.js.map