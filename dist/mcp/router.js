"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mcpRoutes = void 0;
const node_1 = require("@modelcontextprotocol/node");
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const requireAuth_middleware_1 = require("../middleware/requireAuth.middleware");
const server_1 = require("./server");
const mcpRoutes = (0, express_1.Router)();
exports.mcpRoutes = mcpRoutes;
const mcpNodeHandler = (0, node_1.toNodeHandler)(server_1.myBalanceMcpHandler, {
    onerror: (error) => {
        console.error(`[MCP] HTTP adapter error: ${error.message}`);
    },
});
const mcpRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 60,
    message: {
        success: false,
        error: 'Too many MCP requests, please try again later',
        code: 'RATE_LIMIT_EXCEEDED',
    },
    standardHeaders: true,
    legacyHeaders: false,
});
mcpRoutes.post('/', mcpRateLimit, requireAuth_middleware_1.RequireAuthMiddleware.verify, requireAuth_middleware_1.RequireAuthMiddleware.requireScopes(['read']), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const authorization = req.headers.authorization || req.headers['x-authorization'] || '';
    const token = authorization.replace(/^Bearer\s+/i, '');
    req.auth = {
        token,
        clientId: req.deviceId || 'mybalance-client',
        scopes: req.scopes || [],
        extra: {
            userId: req.userId,
            deviceType: req.deviceType || 'web',
            deviceId: req.deviceId,
        },
    };
    yield mcpNodeHandler(req, res, req.body);
}));
mcpRoutes.all('/', (_req, res) => {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(405).json({
        success: false,
        error: 'Method not allowed',
        code: 'METHOD_NOT_ALLOWED',
    });
});
//# sourceMappingURL=router.js.map