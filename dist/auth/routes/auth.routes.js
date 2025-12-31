"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = void 0;
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const requireAuth_middleware_1 = require("../middleware/requireAuth.middleware");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const authRoutes = (0, express_1.Router)();
exports.authRoutes = authRoutes;
// Rate limiting for authentication endpoints
const authRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 requests per windowMs
    message: {
        success: false,
        error: "Too many authentication attempts, please try again later",
        code: "RATE_LIMIT_EXCEEDED",
    },
    standardHeaders: true,
    legacyHeaders: false,
});
const strictAuthRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Stricter limit for sensitive endpoints
    message: {
        success: false,
        error: "Too many attempts, please try again later",
        code: "RATE_LIMIT_EXCEEDED",
    },
    standardHeaders: true,
    legacyHeaders: false,
});
// Public routes (with rate limiting)
authRoutes.post("/google/callback", authRateLimit, auth_controller_1.AuthController.googleCallback);
authRoutes.post("/refresh", authRateLimit, auth_controller_1.AuthController.refresh);
authRoutes.post("/passkey/login", strictAuthRateLimit, auth_controller_1.AuthController.passkeyLogin);
authRoutes.post("/logout", auth_controller_1.AuthController.logout);
// Protected routes (require authentication)
authRoutes.get("/profile", requireAuth_middleware_1.RequireAuthMiddleware.verify, auth_controller_1.AuthController.getProfile);
// Health check endpoint
authRoutes.get("/health", (req, res) => {
    res.json({
        success: true,
        message: "Auth service is healthy",
        timestamp: new Date().toISOString(),
    });
});
//# sourceMappingURL=auth.routes.js.map