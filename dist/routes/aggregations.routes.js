"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aggregationsRoutes = void 0;
const express_1 = require("express");
const aggregations_controller_1 = require("../controllers/aggregations.controller");
const requireAuth_middleware_1 = require("../middleware/requireAuth.middleware");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const aggregationsRoutes = (0, express_1.Router)();
exports.aggregationsRoutes = aggregationsRoutes;
// Rate limiting for aggregations endpoints
const aggregationsRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // Limit each IP to 30 requests per minute
    message: {
        success: false,
        error: 'Too many requests, please try again later',
        code: 'RATE_LIMIT_EXCEEDED',
    },
    standardHeaders: true,
    legacyHeaders: false,
});
// All aggregations routes require authentication
console.log('🔧 Setting up AGGREGATIONS routes...');
/**
 * GET /aggregations/monthly - Restituisce aggregazioni mensili
 */
console.log('🔧 Defining GET /aggregations/monthly route...');
aggregationsRoutes.get('/monthly', aggregationsRateLimit, requireAuth_middleware_1.RequireAuthMiddleware.verify, aggregations_controller_1.AggregationsController.getMonthlyAggregations);
//# sourceMappingURL=aggregations.routes.js.map