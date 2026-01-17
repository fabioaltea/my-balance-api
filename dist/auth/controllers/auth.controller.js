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
exports.AuthController = void 0;
const GoogleAuthHelper_1 = require("../../helpers/GoogleAuthHelper");
const jwt_helper_1 = require("../helpers/jwt.helper");
const crypto_helper_1 = require("../helpers/crypto.helper");
const DbHelper_1 = require("../../helpers/DbHelper");
class AuthController {
    /**
     * Handle Google OAuth callback
     * POST /auth/google/callback
     */
    static googleCallback(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { authorizationCode, codeVerifier, deviceId, deviceType } = req.body;
                if (!authorizationCode || !deviceId) {
                    res.status(400).json({
                        success: false,
                        error: "Missing required fields",
                        required: ["authorizationCode", "deviceId"],
                        optional: ["codeVerifier", "deviceType"],
                    });
                    return;
                }
                const googleOAuthHelper = new GoogleAuthHelper_1.GoogleAuthHelper(deviceType !== null && deviceType !== void 0 ? deviceType : "web");
                // Exchange code for Google tokens
                // Note: codeVerifier is optional - if not provided, PKCE is not used
                const googleTokens = yield googleOAuthHelper.exchangeCodeForTokens({
                    authorizationCode,
                    codeVerifier: codeVerifier || undefined, // Pass undefined if empty string
                });
                // Verify ID token and get user identity
                const identity = yield googleOAuthHelper.verifyIdToken(googleTokens.idToken);
                // Find or create user in database
                let user = yield DbHelper_1.DbHelper.getUserByEmail(identity.email);
                console.log("User response:", user);
                if (!user) {
                    // Create new user
                    user = yield DbHelper_1.DbHelper.createUser({
                        email: identity.email,
                        name: identity.name || "",
                        picture: identity.picture || "",
                        emailVerified: identity.emailVerified,
                    });
                }
                else {
                    // Update existing user with latest info
                    yield DbHelper_1.DbHelper.updateUser(user.user_email, {
                        name: identity.name || user.user_name,
                        picture: identity.picture || user.user_picture,
                        emailVerified: identity.emailVerified,
                    });
                }
                // Update user's last access
                yield DbHelper_1.DbHelper.updateUserLastAccess(user.user_email);
                // Generate JWT tokens
                const tokenPayload = {
                    userId: user.user_email, // Using email as userId for consistency
                    scopes: googleTokens.scopes,
                    deviceType: deviceType || "web", // Include device type in JWT
                };
                const accessToken = jwt_helper_1.JwtHelper.signAccessToken(tokenPayload);
                const refreshToken = jwt_helper_1.JwtHelper.signRefreshToken(tokenPayload);
                // Create session with Google refresh token (for API calls like Sheets)
                // The Google refresh token is stored per-session, not per-user
                const encryptedGoogleRefreshToken = googleTokens.refreshToken
                    ? crypto_helper_1.CryptoHelper.encrypt(googleTokens.refreshToken)
                    : undefined;
                const sessionId = yield DbHelper_1.DbHelper.createSession({
                    userEmail: user.user_email,
                    deviceId,
                    scopes: googleTokens.scopes,
                    deviceType: deviceType || "web",
                    googleRefreshToken: encryptedGoogleRefreshToken,
                });
                res.json({
                    success: true,
                    accessToken,
                    refreshToken, // JWT refresh token
                    user: {
                        id: user.id,
                        email: user.user_email,
                        name: user.user_name,
                        picture: user.user_picture,
                    },
                });
            }
            catch (error) {
                console.error("Google callback error:", error);
                res.status(500).json({
                    success: false,
                    error: "Authentication failed",
                    details: error.message,
                });
            }
        });
    }
    /**
     * Refresh access token
     * POST /auth/refresh
     */
    static refresh(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log("🔄 Token refresh request received");
                const { refreshToken, deviceId } = req.body;
                console.log("🔄 Device ID:", deviceId);
                console.log("🔄 Refresh token (first 50 chars):", refreshToken === null || refreshToken === void 0 ? void 0 : refreshToken.substring(0, 50));
                if (!refreshToken || !deviceId) {
                    console.log("❌ Missing refresh token or device ID");
                    res.status(400).json({
                        success: false,
                        error: "Missing refresh token or device ID",
                    });
                    return;
                }
                // Verify JWT refresh token
                console.log("🔄 Verifying JWT refresh token...");
                const decoded = jwt_helper_1.JwtHelper.verifyRefreshToken(refreshToken);
                if (!decoded) {
                    console.log("❌ JWT verification failed - token invalid or expired");
                    res.status(401).json({
                        success: false,
                        error: "Invalid or expired refresh token",
                        code: "INVALID_REFRESH_TOKEN",
                    });
                    return;
                }
                console.log("✅ JWT verified, userId:", decoded.userId);
                // Check if session exists (for revocation support)
                console.log("🔄 Looking up session for device:", deviceId);
                const session = yield DbHelper_1.DbHelper.getSessionByDeviceId(deviceId);
                if (!session) {
                    console.log("❌ Session not found or expired for device:", deviceId);
                    res.status(401).json({
                        success: false,
                        error: "Session not found or revoked",
                        code: "SESSION_REVOKED",
                    });
                    return;
                }
                console.log("✅ Session found for user:", session.user_email);
                // Verify the token belongs to the session user
                if (decoded.userId !== session.user_email) {
                    res.status(401).json({
                        success: false,
                        error: "Token does not match session",
                        code: "TOKEN_MISMATCH",
                    });
                    return;
                }
                // Get user info
                const user = yield DbHelper_1.DbHelper.getUserByEmail(session.user_email);
                if (!user) {
                    res.status(404).json({
                        success: false,
                        error: "User not found",
                    });
                    return;
                }
                // Generate new access token (keep same refresh token - JWT is self-validating)
                const tokenPayload = {
                    userId: user.user_email,
                    scopes: decoded.scopes || session.scopes || [],
                    deviceType: decoded.deviceType || session.device_type || "web",
                };
                const accessToken = jwt_helper_1.JwtHelper.signAccessToken(tokenPayload);
                res.json({
                    success: true,
                    accessToken,
                    refreshToken, // Return same refresh token (JWT doesn't need rotation)
                });
            }
            catch (error) {
                console.error("Token refresh error:", error);
                res.status(500).json({
                    success: false,
                    error: "Failed to refresh token",
                    details: error.message,
                });
            }
        });
    }
    /**
     * Passkey authentication - TODO: Fix WebAuthn types
     * POST /auth/passkey/login
     */
    static passkeyLogin(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // TODO: Implement WebAuthn passkey login after fixing type issues
                res.status(501).json({
                    success: false,
                    error: "Passkey authentication not yet implemented",
                    message: "Use Google OAuth for authentication",
                });
            }
            catch (error) {
                console.error("Passkey login error:", error);
                res.status(500).json({
                    success: false,
                    error: "Passkey authentication failed",
                    details: error.message,
                });
            }
        });
    }
    /**
     * Logout - revoke current session
     * POST /auth/logout
     */
    static logout(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { deviceId, refreshToken } = req.body;
                if (!deviceId) {
                    res.status(400).json({
                        success: false,
                        error: "Missing device ID",
                    });
                    return;
                }
                // Revoke session
                yield DbHelper_1.DbHelper.revokeSession(deviceId);
                res.json({
                    success: true,
                    message: "Logged out successfully",
                });
            }
            catch (error) {
                console.error("Logout error:", error);
                res.status(500).json({
                    success: false,
                    error: "Failed to logout",
                    details: error.message,
                });
            }
        });
    }
    /**
     * Get user profile (requires authentication)
     * GET /auth/profile
     */
    static getProfile(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userEmail = req.userId; // Set by auth middleware (now contains email)
                let user = yield DbHelper_1.DbHelper.getUserByEmail(userEmail);
                if (!user) {
                    res.status(404).json({
                        success: false,
                        error: "User not found",
                    });
                    return;
                }
                // If user doesn't have a spreadsheet ID, they'll need to create one
                // For now, we return the profile without spreadsheetId and let the frontend handle it
                if (!user.spreadsheet_id) {
                    console.log(`⚠️ User ${userEmail} has no spreadsheet configured - will use quickstart mode`);
                }
                res.json({
                    success: true,
                    user: {
                        id: user.user_email,
                        email: user.user_email,
                        name: user.user_name,
                        picture: user.user_picture,
                        emailVerified: user.email_verified,
                        spreadsheetId: user.spreadsheet_id || null, // Can be null for new users
                        lastAccess: user.last_access,
                    },
                });
            }
            catch (error) {
                console.error("Get profile error:", error);
                res.status(500).json({
                    success: false,
                    error: "Failed to get profile",
                    details: error.message,
                });
            }
        });
    }
}
exports.AuthController = AuthController;
//# sourceMappingURL=auth.controller.js.map