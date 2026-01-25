"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.shortcutRoutes = void 0;
const express_1 = require("express");
const shortcut_controller_1 = require("../controllers/shortcut.controller");
const requireAuth_middleware_1 = require("../middleware/requireAuth.middleware");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const shortcutRoutes = (0, express_1.Router)();
exports.shortcutRoutes = shortcutRoutes;
// Rate limiting for shortcut endpoints
const shortcutRateLimit = (0, express_rate_limit_1.default)({
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
console.log("🔧 Setting up SHORTCUT routes...");
/**
 * POST /shortcut/generate - Generate new shortcut key (requires JWT auth)
 */
shortcutRoutes.post("/generate", shortcutRateLimit, requireAuth_middleware_1.RequireAuthMiddleware.verify, shortcut_controller_1.ShortcutController.generateShortcutKey);
/**
 * GET /shortcut/key - Get current shortcut key (requires JWT auth)
 */
shortcutRoutes.get("/key", shortcutRateLimit, requireAuth_middleware_1.RequireAuthMiddleware.verify, shortcut_controller_1.ShortcutController.getShortcutKey);
/**
 * POST /shortcut/movement - Create movement via shortcut (uses x-shortcutkey header)
 */
shortcutRoutes.post("/movement", shortcutRateLimit, shortcut_controller_1.ShortcutController.createMovementViaShortcut);
//# sourceMappingURL=shortcut.routes.js.map