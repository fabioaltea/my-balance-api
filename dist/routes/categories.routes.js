"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoriesRoutes = void 0;
const express_1 = require("express");
const categories_controller_1 = require("../controllers/categories.controller");
const requireAuth_middleware_1 = require("../middleware/requireAuth.middleware");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const categoriesRoutes = (0, express_1.Router)();
exports.categoriesRoutes = categoriesRoutes;
// Rate limiting for categories endpoints
const categoriesRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // Limit each IP to 60 requests per minute
    message: {
        success: false,
        error: "Too many requests, please try again later",
        code: "RATE_LIMIT_EXCEEDED",
    },
    standardHeaders: true,
    legacyHeaders: false,
});
console.log("🔧 Setting up CATEGORIES routes...");
/**
 * GET /categories/default - Recupera categorie default (pubblico)
 */
categoriesRoutes.get("/default", categoriesRateLimit, categories_controller_1.CategoriesController.getDefaultCategories);
/**
 * GET /categories - Recupera tutte le categorie
 */
categoriesRoutes.get("/", categoriesRateLimit, requireAuth_middleware_1.RequireAuthMiddleware.verify, categories_controller_1.CategoriesController.getCategories);
/**
 * POST /categories - Crea nuova categoria
 */
categoriesRoutes.post("/", categoriesRateLimit, requireAuth_middleware_1.RequireAuthMiddleware.verify, categories_controller_1.CategoriesController.createCategory);
/**
 * POST /categories/batch - Crea categorie in batch
 */
categoriesRoutes.post("/batch", categoriesRateLimit, requireAuth_middleware_1.RequireAuthMiddleware.verify, categories_controller_1.CategoriesController.createCategoriesBatch);
/**
 * GET /categories/:categoryId - Recupera singola categoria
 */
categoriesRoutes.get("/:categoryId", categoriesRateLimit, requireAuth_middleware_1.RequireAuthMiddleware.verify, categories_controller_1.CategoriesController.getCategory);
/**
 * PUT /categories/:categoryId - Aggiorna categoria esistente
 */
categoriesRoutes.put("/:categoryId", categoriesRateLimit, requireAuth_middleware_1.RequireAuthMiddleware.verify, categories_controller_1.CategoriesController.updateCategory);
/**
 * DELETE /categories/:categoryId - Elimina categoria
 */
categoriesRoutes.delete("/:categoryId", categoriesRateLimit, requireAuth_middleware_1.RequireAuthMiddleware.verify, categories_controller_1.CategoriesController.deleteCategory);
//# sourceMappingURL=categories.routes.js.map