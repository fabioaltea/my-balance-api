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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequireAuthMiddleware = void 0;
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:8082';
class RequireAuthMiddleware {
    /**
     * Middleware to verify JWT access token via Auth service
     * Calls POST /auth/token/verify on the centralized auth service
     */
    static verify(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🔐 === AUTH MIDDLEWARE START ===');
            try {
                const authHeader = req.headers.authorization || req.headers['x-authorization'];
                console.log('🔐 Authorization header:', req.headers.authorization ? 'present' : 'missing');
                if (!authHeader) {
                    console.log('❌ No auth header found, returning 401');
                    res.status(401).json({
                        success: false,
                        error: 'Missing authorization token',
                        code: 'MISSING_TOKEN',
                    });
                    return;
                }
                // Call auth service to verify token using fetch
                console.log('🔐 Calling auth service to verify token...');
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);
                const response = yield fetch(`${AUTH_SERVICE_URL}/auth/token/verify`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: authHeader,
                    },
                    signal: controller.signal,
                });
                clearTimeout(timeoutId);
                const data = yield response.json();
                if (!response.ok || !data.valid) {
                    console.log('❌ Token invalid:', data.code);
                    res.status(401).json({
                        success: false,
                        error: data.error || 'Invalid token',
                        code: data.code || 'INVALID_TOKEN',
                    });
                    return;
                }
                console.log('✅ Token verified by auth service. User:', data.userId);
                // Attach user info from auth service response
                req.userId = data.userId;
                req.scopes = data.scopes;
                req.deviceType = data.deviceType || 'web';
                req.deviceId = data.deviceId;
                console.log('🔐 Auth middleware completed successfully, calling next()');
                next();
            }
            catch (error) {
                console.error('❌ Authentication middleware error:', error.message);
                // Auth service unavailable or timeout
                res.status(503).json({
                    success: false,
                    error: 'Authentication service unavailable',
                    code: 'AUTH_SERVICE_UNAVAILABLE',
                });
            }
            console.log('🔐 === AUTH MIDDLEWARE END ===');
        });
    }
    /**
     * Middleware to verify specific scopes
     */
    static requireScopes(requiredScopes) {
        return (req, res, next) => {
            if (!req.scopes) {
                res.status(403).json({
                    success: false,
                    error: 'Authentication required',
                    code: 'AUTH_REQUIRED',
                });
                return;
            }
            const hasAllScopes = requiredScopes.every((scope) => { var _a; return (_a = req.scopes) === null || _a === void 0 ? void 0 : _a.includes(scope); });
            if (!hasAllScopes) {
                res.status(403).json({
                    success: false,
                    error: 'Insufficient permissions',
                    code: 'INSUFFICIENT_SCOPES',
                    required: requiredScopes,
                    current: req.scopes,
                });
                return;
            }
            next();
        };
    }
    /**
     * Optional authentication - doesn't fail if no token provided
     * Calls auth service but continues even if token is invalid
     */
    static optional(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const authHeader = req.headers.authorization || req.headers['x-authorization'];
                if (authHeader) {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 5000);
                    const response = yield fetch(`${AUTH_SERVICE_URL}/auth/token/verify`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: authHeader,
                        },
                        signal: controller.signal,
                    });
                    clearTimeout(timeoutId);
                    if (response.ok) {
                        const data = yield response.json();
                        if (data.valid) {
                            req.userId = data.userId;
                            req.scopes = data.scopes;
                            req.deviceType = data.deviceType;
                            req.deviceId = data.deviceId;
                        }
                    }
                }
                next();
            }
            catch (error) {
                // For optional auth, we continue even if token is invalid
                next();
            }
        });
    }
}
exports.RequireAuthMiddleware = RequireAuthMiddleware;
//# sourceMappingURL=requireAuth.middleware.js.map