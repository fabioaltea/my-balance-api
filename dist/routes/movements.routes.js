"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.movementsRoutes = void 0;
const express_1 = require("express");
const movements_controller_1 = require("../controllers/movements.controller");
const requireAuth_middleware_1 = require("../middleware/requireAuth.middleware");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const movementsRoutes = (0, express_1.Router)();
exports.movementsRoutes = movementsRoutes;
// Rate limiting for movements endpoints
const movementsRateLimit = (0, express_rate_limit_1.default)({
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
// All movements routes require authentication
console.log("🔧 Setting up MOVEMENTS routes...");
/**
 * GET /movements - Recupera tutti i movements
 */
console.log("🔧 Defining GET /movements route...");
movementsRoutes.get("/", movementsRateLimit, (req, res, next) => {
    console.log("🔧 GET /movements route hit - before auth middleware");
    next();
}, requireAuth_middleware_1.RequireAuthMiddleware.verify, movements_controller_1.MovementsController.getMovements);
/**
 * POST /movements - Crea nuovo movement
 */
movementsRoutes.post("/", movementsRateLimit, requireAuth_middleware_1.RequireAuthMiddleware.verify, movements_controller_1.MovementsController.createMovement);
/**
 * POST /movements/batch - Aggiorna multipli movements in batch
 */
movementsRoutes.post("/batch", movementsRateLimit, requireAuth_middleware_1.RequireAuthMiddleware.verify, movements_controller_1.MovementsController.updateMovementsBatch);
/**
 * GET /movements/:movementId - Recupera singolo movement
 */
movementsRoutes.get("/:movementId", movementsRateLimit, requireAuth_middleware_1.RequireAuthMiddleware.verify, movements_controller_1.MovementsController.getMovement);
/**
 * PUT /movements/:movementId - Aggiorna movement esistente
 */
movementsRoutes.put("/:movementId", movementsRateLimit, requireAuth_middleware_1.RequireAuthMiddleware.verify, movements_controller_1.MovementsController.updateMovement);
/**
 * DELETE /movements/:movementId - Elimina movement
 */
movementsRoutes.delete("/:movementId", movementsRateLimit, requireAuth_middleware_1.RequireAuthMiddleware.verify, movements_controller_1.MovementsController.deleteMovement);
//# sourceMappingURL=movements.routes.js.map