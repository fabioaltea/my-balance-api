import { Router } from "express";
import { AccountsController } from "../controllers/accounts.controller";
import { RequireAuthMiddleware } from "../middleware/requireAuth.middleware";
import rateLimit from "express-rate-limit";

const accountsRoutes = Router();

// Rate limiting for accounts endpoints
const accountsRateLimit = rateLimit({
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
accountsRoutes.get(
  "/balances",
  accountsRateLimit,
  (req, res, next) => {
    console.log("🔧 GET /accounts/balances route hit - before auth middleware");
    next();
  },
  RequireAuthMiddleware.verify,
  AccountsController.getAccountBalances,
);

/**
 * GET /accounts - Recupera tutti gli accounts
 */
console.log("🔧 Defining GET /accounts route...");
accountsRoutes.get(
  "/",
  accountsRateLimit,
  (req, res, next) => {
    console.log("🔧 GET /accounts route hit - before auth middleware");
    next();
  },
  RequireAuthMiddleware.verify,
  AccountsController.getAccounts,
);

/**
 * POST /accounts - Crea nuovo account
 */
console.log("🔧 Defining POST /accounts route...");
accountsRoutes.post(
  "/",
  accountsRateLimit,
  (req, res, next) => {
    console.log("🔧 POST /accounts route hit - before auth middleware");
    next();
  },
  RequireAuthMiddleware.verify,
  AccountsController.createAccount,
);

/**
 * PUT /accounts/:accountId - Aggiorna account esistente
 */
accountsRoutes.put(
  "/:accountId",
  accountsRateLimit,
  RequireAuthMiddleware.verify,
  AccountsController.updateAccount,
);

/**
 * DELETE /accounts/:accountId - Elimina account
 */
accountsRoutes.delete(
  "/:accountId",
  accountsRateLimit,
  RequireAuthMiddleware.verify,
  AccountsController.deleteAccount,
);

/**
 * POST /accounts/batch - Crea multipli accounts in batch
 */
accountsRoutes.post(
  "/batch",
  accountsRateLimit,
  RequireAuthMiddleware.verify,
  AccountsController.createAccountsBatch,
);

export { accountsRoutes };
