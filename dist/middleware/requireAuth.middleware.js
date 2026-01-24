"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequireAuthMiddleware = void 0;
const jwt_helper_1 = require("../helpers/jwt.helper");
class RequireAuthMiddleware {
    /**
     * Middleware to verify JWT access token
     */
    static verify(req, res, next) {
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
            });
            // Attach user info to request
            req.userId = payload.userId;
            req.scopes = payload.scopes;
            req.deviceType = payload.deviceType || "web"; // Default to web if not specified
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