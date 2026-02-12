import { Router } from "express";
import { TransactionsController } from "../controllers/transactions.controller";
import { RequireAuthMiddleware } from "../middleware/requireAuth.middleware";
import rateLimit from "express-rate-limit";

const transactionsRoutes = Router();

// Rate limiting for transactions endpoints
const transactionsRateLimit = rateLimit({
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
 * GET /transactions - Restituisce tutte le transazioni
 */
console.log("🔧 Defining GET /transactions route...");
transactionsRoutes.get(
  "/",
  transactionsRateLimit,
  (req, res, next) => {
    console.log("🔧 GET /transactions route hit - before auth middleware");
    next();
  },
  RequireAuthMiddleware.verify,
  TransactionsController.getTransactions,
);

/**
 * GET /transactions/delta - Restituisce transazioni modificate da un certo timestamp
 */
transactionsRoutes.get(
  "/delta",
  transactionsRateLimit,
  RequireAuthMiddleware.verify,
  TransactionsController.getTransactionsDelta,
);

/**
 * POST /transactions - Crea nuova transazione
 */
transactionsRoutes.post(
  "/",
  transactionsRateLimit,
  RequireAuthMiddleware.verify,
  TransactionsController.createTransaction,
);

/**
 * GET /transactions/:transactionId - Recupera singola transazione
 */
transactionsRoutes.get(
  "/:transactionId",
  transactionsRateLimit,
  RequireAuthMiddleware.verify,
  TransactionsController.getTransaction,
);

/**
 * PUT /transactions/:transactionId - Aggiorna transazione esistente
 */
transactionsRoutes.put(
  "/:transactionId",
  transactionsRateLimit,
  RequireAuthMiddleware.verify,
  TransactionsController.updateTransaction,
);

/**
 * DELETE /transactions/:transactionId - Elimina transazione
 */
transactionsRoutes.delete(
  "/:transactionId",
  transactionsRateLimit,
  RequireAuthMiddleware.verify,
  TransactionsController.deleteTransaction,
);

export { transactionsRoutes };
