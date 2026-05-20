"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saltedgeRoutes = void 0;
const express_1 = require("express");
const saltedge_controller_1 = require("../controllers/saltedge.controller");
const requireAuth_middleware_1 = require("../middleware/requireAuth.middleware");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const saltedgeRoutes = (0, express_1.Router)();
exports.saltedgeRoutes = saltedgeRoutes;
const saltedgeRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 1 * 60 * 1000,
    max: 20,
    message: { success: false, error: 'Too many requests', code: 'RATE_LIMIT_EXCEEDED' },
    standardHeaders: true,
    legacyHeaders: false,
});
// Connect widget — create session
saltedgeRoutes.post('/connect', saltedgeRateLimit, requireAuth_middleware_1.RequireAuthMiddleware.verify, saltedge_controller_1.SaltEdgeController.connect);
// Reconnect widget for already-linked account
saltedgeRoutes.post('/reconnect/:accountId', saltedgeRateLimit, requireAuth_middleware_1.RequireAuthMiddleware.verify, saltedge_controller_1.SaltEdgeController.reconnect);
// Link a SaltEdge connection to a MyBalance account (after widget completes)
saltedgeRoutes.post('/link', saltedgeRateLimit, requireAuth_middleware_1.RequireAuthMiddleware.verify, saltedge_controller_1.SaltEdgeController.link);
// Disconnect / unlink
saltedgeRoutes.delete('/disconnect/:accountId', saltedgeRateLimit, requireAuth_middleware_1.RequireAuthMiddleware.verify, saltedge_controller_1.SaltEdgeController.disconnect);
// Manual sync
saltedgeRoutes.post('/sync/:accountId', saltedgeRateLimit, requireAuth_middleware_1.RequireAuthMiddleware.verify, saltedge_controller_1.SaltEdgeController.sync);
// Connection status
saltedgeRoutes.get('/connections/:accountId', saltedgeRateLimit, requireAuth_middleware_1.RequireAuthMiddleware.verify, saltedge_controller_1.SaltEdgeController.getConnection);
// Webhook — public, no JWT
saltedgeRoutes.post('/webhook', saltedge_controller_1.SaltEdgeController.webhook);
//# sourceMappingURL=saltedge.routes.js.map