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
const googleOAuth_helper_1 = require("../helpers/googleOAuth.helper");
const jwt_helper_1 = require("../helpers/jwt.helper");
const refreshToken_helper_1 = require("../helpers/refreshToken.helper");
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
                const { authorizationCode, codeVerifier, deviceId } = req.body;
                if (!authorizationCode || !deviceId) {
                    res.status(400).json({
                        success: false,
                        error: "Missing required fields",
                        required: ["authorizationCode", "deviceId"],
                        optional: ["codeVerifier"],
                    });
                    return;
                }
                // Exchange code for Google tokens
                // Note: codeVerifier is optional - if not provided, PKCE is not used
                const googleTokens = yield googleOAuth_helper_1.GoogleOAuthHelper.exchangeCodeForTokens({
                    authorizationCode,
                    codeVerifier: codeVerifier || undefined, // Pass undefined if empty string
                    clientId: process.env.CLIENT_ID,
                    clientSecret: process.env.CLIENT_SECRET,
                    redirectUri: process.env.REDIRECT_URI,
                });
                // Verify ID token and get user identity
                const identity = yield googleOAuth_helper_1.GoogleOAuthHelper.verifyIdToken(googleTokens.idToken);
                // Find or create user in database
                let user = yield DbHelper_1.DbHelper.getUserByEmail(identity.email);
                console.log("User response:", user);
                if (!user) {
                    // Create new user
                    user = yield DbHelper_1.DbHelper.createUser({
                        email: identity.email,
                        googleSub: identity.googleSub,
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
                        googleSub: identity.googleSub,
                    });
                }
                // Store encrypted Google refresh token if provided
                if (googleTokens.refreshToken) {
                    const encryptedRefreshToken = crypto_helper_1.CryptoHelper.encrypt(googleTokens.refreshToken);
                    yield DbHelper_1.DbHelper.storeGoogleRefreshToken(user.user_email, encryptedRefreshToken);
                }
                // Update user's last access
                yield DbHelper_1.DbHelper.updateUserLastAccess(user.user_email);
                // Generate internal refresh token
                const internalRefreshToken = refreshToken_helper_1.RefreshTokenHelper.generateRefreshToken();
                // Create session
                const sessionId = yield DbHelper_1.DbHelper.createSession({
                    userEmail: user.user_email,
                    deviceId,
                    refreshTokenHash: internalRefreshToken.hash,
                    expiresAt: internalRefreshToken.expiresAt,
                    scopes: googleTokens.scopes,
                });
                // Generate JWT tokens
                const tokenPayload = {
                    userId: user.user_email, // Using email as userId for consistency
                    scopes: googleTokens.scopes,
                };
                const accessToken = jwt_helper_1.JwtHelper.signAccessToken(tokenPayload);
                const refreshToken = jwt_helper_1.JwtHelper.signRefreshToken(tokenPayload);
                res.json({
                    success: true,
                    accessToken,
                    refreshToken, // Use JWT refresh token instead of Google internal token
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
                const { refreshToken, deviceId } = req.body;
                if (!refreshToken || !deviceId) {
                    res.status(400).json({
                        success: false,
                        error: "Missing refresh token or device ID",
                    });
                    return;
                }
                // Get session from database
                const session = yield DbHelper_1.DbHelper.getSessionByDeviceId(deviceId);
                if (!session || refreshToken_helper_1.RefreshTokenHelper.isTokenExpired(session.expires_at)) {
                    res.status(401).json({
                        success: false,
                        error: "Invalid or expired session",
                        code: "SESSION_EXPIRED",
                    });
                    return;
                }
                // Verify refresh token hash
                if (!refreshToken_helper_1.RefreshTokenHelper.verifyRefreshToken(refreshToken, session.refresh_token_hash)) {
                    res.status(401).json({
                        success: false,
                        error: "Invalid refresh token",
                        code: "INVALID_REFRESH_TOKEN",
                    });
                    return;
                }
                // Generate new refresh token (rotation)
                const newRefreshToken = refreshToken_helper_1.RefreshTokenHelper.generateRefreshToken();
                // Update session with new refresh token
                yield DbHelper_1.DbHelper.updateSession(session.id, {
                    refreshTokenHash: newRefreshToken.hash,
                    expiresAt: newRefreshToken.expiresAt,
                });
                // Get user info
                const user = yield DbHelper_1.DbHelper.getUserByEmail(session.user_email);
                if (!user) {
                    res.status(404).json({
                        success: false,
                        error: "User not found",
                    });
                    return;
                }
                // Generate new access token
                const tokenPayload = {
                    userId: user.user_email, // Using email as userId for consistency
                    scopes: session.scopes || [],
                };
                const accessToken = jwt_helper_1.JwtHelper.signAccessToken(tokenPayload);
                res.json({
                    success: true,
                    accessToken,
                    refreshToken: newRefreshToken.raw,
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
                const user = yield DbHelper_1.DbHelper.getUserByEmail(userEmail);
                if (!user) {
                    res.status(404).json({
                        success: false,
                        error: "User not found",
                    });
                    return;
                }
                res.json({
                    success: true,
                    user: {
                        id: user.user_email,
                        email: user.user_email,
                        name: user.user_name,
                        picture: user.user_picture,
                        emailVerified: user.email_verified,
                        spreadsheetId: user.spreadsheet_id,
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