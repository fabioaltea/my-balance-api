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
const jwt_helper_1 = require("../helpers/jwt.helper");
const DbHelper_1 = require("../helpers/DbHelper");
class RequireAuthMiddleware {
    /**
     * Middleware to verify JWT access token and session
     */
    static verify(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("🔐 === AUTH MIDDLEWARE START ===");
            try {
                const authHeader = req.headers.authorization || req.headers["x-authorization"];
                const token = jwt_helper_1.JwtHelper.extractTokenFromHeader(authHeader);
                console.log("🔐 Authorization header:", req.headers.authorization ? "present" : "missing");
                console.log("🔐 X-Authorization header:", req.headers["x-authorization"] ? "present" : "missing");
                console.log("🔐 Extracted token:", token ? "present" : "missing");
                if (!token) {
                    console.log("❌ No token found, returning 401");
                    res.status(401).json({
                        success: false,
                        error: "Missing authorization token",
                        code: "MISSING_TOKEN",
                    });
                    return;
                }
                console.log("🔐 Verifying access token...");
                const payload = jwt_helper_1.JwtHelper.verifyAccessToken(token);
                console.log("✅ Token verified successfully. Payload:", {
                    userId: payload.userId,
                    scopes: payload.scopes,
                    deviceType: payload.deviceType,
                    deviceId: payload.deviceId,
                });
                // Verify session exists for this deviceId
                if (payload.deviceId) {
                    const session = yield DbHelper_1.DbHelper.getSessionByDeviceId(payload.deviceId);
                    if (!session) {
                        console.log("❌ Session not found for deviceId:", payload.deviceId);
                        res.status(401).json({
                            success: false,
                            error: "Session not found or revoked",
                            code: "SESSION_REVOKED",
                        });
                        return;
                    }
                    console.log("✅ Session verified for deviceId:", payload.deviceId);
                }
                // Attach user info to request
                req.userId = payload.userId;
                req.scopes = payload.scopes;
                req.deviceType = payload.deviceType || "web"; // Default to web if not specified
                req.deviceId = payload.deviceId;
                console.log("🔐 Auth middleware completed successfully, calling next()");
                next();
            }
            catch (error) {
                console.error("❌ Authentication middleware error:", error);
                let errorCode = "INVALID_TOKEN";
                let message = "Invalid or expired access token";
                if (error.message.includes("expired")) {
                    errorCode = "TOKEN_EXPIRED";
                    message = "Access token has expired";
                }
                console.log("❌ Returning auth error:", { errorCode, message });
                res.status(401).json({
                    success: false,
                    error: message,
                    code: errorCode,
                });
            }
            console.log("🔐 === AUTH MIDDLEWARE END ===");
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
                    error: "Authentication required",
                    code: "AUTH_REQUIRED",
                });
                return;
            }
            const hasAllScopes = requiredScopes.every((scope) => { var _a; return (_a = req.scopes) === null || _a === void 0 ? void 0 : _a.includes(scope); });
            if (!hasAllScopes) {
                res.status(403).json({
                    success: false,
                    error: "Insufficient permissions",
                    code: "INSUFFICIENT_SCOPES",
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
     */
    static optional(req, res, next) {
        try {
            const authHeader = req.headers.authorization || req.headers["x-authorization"];
            const token = jwt_helper_1.JwtHelper.extractTokenFromHeader(authHeader);
            if (token) {
                const payload = jwt_helper_1.JwtHelper.verifyAccessToken(token);
                req.userId = payload.userId;
                req.scopes = payload.scopes;
            }
            next();
        }
        catch (error) {
            // For optional auth, we continue even if token is invalid
            next();
        }
    }
}
exports.RequireAuthMiddleware = RequireAuthMiddleware;
//# sourceMappingURL=requireAuth.middleware.js.map