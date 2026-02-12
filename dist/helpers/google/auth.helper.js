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
exports.GoogleOAuthHelper = exports.GoogleAuthHelper = exports.GoogleTokenError = void 0;
const google_auth_library_1 = require("google-auth-library");
const crypto_helper_1 = require("../crypto.helper");
const db_helper_1 = require("../db.helper");
// Custom error for Google token issues that require re-authentication
class GoogleTokenError extends Error {
    constructor(message, code = "GOOGLE_TOKEN_INVALID") {
        super(message);
        this.name = "GoogleTokenError";
        this.code = code;
    }
}
exports.GoogleTokenError = GoogleTokenError;
// ============================================================================
// GOOGLE AUTH HELPER - Unified helper for all Google OAuth operations
// ============================================================================
class GoogleAuthHelper {
    // ============================================================================
    // CONSTRUCTOR & CLIENT INITIALIZATION
    // ============================================================================
    constructor(deviceType = "web") {
        this.deviceType = deviceType;
        this.initializeClient(deviceType);
    }
    initializeClient(deviceType) {
        switch (deviceType) {
            case "ios":
                this.loadIOSClient();
                break;
            case "android":
                this.loadAndroidClient();
                break;
            case "web":
            default:
                this.loadWebClient();
                break;
        }
    }
    loadWebClient() {
        console.log("Loading web OAuth2 client with params:", {
            clientId: process.env.CLIENT_ID_WEB,
            clientSecret: process.env.CLIENT_SECRET ? "***" : undefined,
            redirectUri: process.env.REDIRECT_URI_WEB,
        });
        this.client = new google_auth_library_1.OAuth2Client(process.env.CLIENT_ID_WEB, process.env.CLIENT_SECRET, process.env.REDIRECT_URI_WEB);
    }
    loadIOSClient() {
        // iOS is a "public client" - no client secret
        this.client = new google_auth_library_1.OAuth2Client({
            clientId: process.env.CLIENT_ID_IOS,
            redirectUri: process.env.REDIRECT_URI_IOS,
        });
    }
    loadAndroidClient() {
        console.log("Loading Android OAuth2 client with params:", {
            clientId: process.env.CLIENT_ID_ANDROID,
            redirectUri: process.env.REDIRECT_URI_ANDROID || process.env.REDIRECT_URI_IOS,
        });
        // Android is a "public client" - no client secret
        this.client = new google_auth_library_1.OAuth2Client({
            clientId: process.env.CLIENT_ID_ANDROID || process.env.CLIENT_ID_IOS,
            redirectUri: process.env.REDIRECT_URI_ANDROID || process.env.REDIRECT_URI_IOS,
        });
    }
    // ============================================================================
    // PUBLIC GETTERS
    // ============================================================================
    /**
     * Get the underlying OAuth2 client
     */
    getClient() {
        return this.client;
    }
    /**
     * Get the device type this helper was initialized with
     */
    getDeviceType() {
        return this.deviceType;
    }
    // ============================================================================
    // TOKEN EXCHANGE & VERIFICATION (for login flow)
    // ============================================================================
    /**
     * Exchange authorization code for Google tokens
     */
    exchangeCodeForTokens(params) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            try {
                // Prepare token request - only include codeVerifier if provided (for PKCE)
                const tokenRequest = {
                    code: params.authorizationCode,
                };
                // Only add codeVerifier if it's provided and not empty
                if (params.codeVerifier && params.codeVerifier.trim()) {
                    tokenRequest.codeVerifier = params.codeVerifier;
                    console.log("Using PKCE code verifier for token exchange");
                }
                // If redirectUri is provided, use it (needed for web where the URI is dynamic)
                if (params.redirectUri) {
                    tokenRequest.redirect_uri = params.redirectUri;
                    console.log("Using custom redirect URI for token exchange:", params.redirectUri);
                }
                const { tokens } = yield this.client.getToken(tokenRequest);
                if (!tokens.id_token) {
                    throw new Error("No ID token received from Google");
                }
                return {
                    idToken: tokens.id_token,
                    refreshToken: tokens.refresh_token || undefined,
                    scopes: ((_a = tokens.scope) === null || _a === void 0 ? void 0 : _a.split(" ")) || [],
                };
            }
            catch (error) {
                console.error("Error exchanging authorization code:", ((_c = (_b = error.response) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.error_description) || error.message);
                throw new Error(`Failed to exchange authorization code: ${error.message}`);
            }
        });
    }
    /**
     * Verify Google ID token and extract identity information
     */
    verifyIdToken(idToken) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("Verifying ID token for client", this.client._clientId);
            try {
                const ticket = yield this.client.verifyIdToken({
                    idToken: idToken,
                    audience: this.client._clientId,
                });
                const payload = ticket.getPayload();
                if (!payload) {
                    throw new Error("Invalid ID token payload");
                }
                // Verify issuer
                if (payload.iss !== "https://accounts.google.com" &&
                    payload.iss !== "accounts.google.com") {
                    throw new Error("Invalid token issuer");
                }
                // Verify audience
                if (payload.aud !== this.client._clientId) {
                    throw new Error("Invalid token audience");
                }
                if (!payload.email) {
                    throw new Error("Missing required fields in ID token");
                }
                return {
                    email: payload.email,
                    emailVerified: payload.email_verified || false,
                    name: payload.name,
                    picture: payload.picture,
                };
            }
            catch (error) {
                console.error("Error verifying ID token:", error);
                throw new Error(`Failed to verify ID token: ${error.message}`);
            }
        });
    }
    // ============================================================================
    // AUTHENTICATED CLIENT (for API calls like Sheets)
    // ============================================================================
    /**
     * Set credentials on the client (refresh token) for making authenticated API calls
     */
    setCredentials(refreshToken) {
        this.client.setCredentials({
            refresh_token: refreshToken,
        });
    }
    /**
     * Refresh the access token if needed
     * Also returns new refresh token if Google rotates it
     */
    refreshAccessToken() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            try {
                // getAccessToken() internally refreshes if needed
                const { token, res } = yield this.client.getAccessToken();
                if (!token) {
                    throw new GoogleTokenError("Failed to obtain access token - refresh token may be invalid", "GOOGLE_TOKEN_REFRESH_FAILED");
                }
                // Check if Google returned a new refresh token (token rotation)
                const credentials = this.client.credentials;
                const newRefreshToken = credentials.refresh_token;
                // Log if we got a rotated token
                if (newRefreshToken && ((_a = res === null || res === void 0 ? void 0 : res.data) === null || _a === void 0 ? void 0 : _a.refresh_token)) {
                    console.log("🔄 Google returned a new refresh token (token rotation)");
                }
                return {
                    accessToken: token,
                    newRefreshToken: ((_b = res === null || res === void 0 ? void 0 : res.data) === null || _b === void 0 ? void 0 : _b.refresh_token) || undefined,
                };
            }
            catch (error) {
                console.error("Error refreshing access token:", error);
                // Check for specific Google errors that indicate token is invalid
                const errorMessage = ((_c = error.message) === null || _c === void 0 ? void 0 : _c.toLowerCase()) || "";
                const isTokenInvalid = errorMessage.includes("invalid_grant") ||
                    errorMessage.includes("token has been expired or revoked") ||
                    errorMessage.includes("token has been revoked") ||
                    errorMessage.includes("invalid credentials") ||
                    error.code === 401;
                if (isTokenInvalid) {
                    throw new GoogleTokenError("Google refresh token is invalid or revoked. User must re-authenticate.", "GOOGLE_TOKEN_REVOKED");
                }
                throw new GoogleTokenError(`Failed to refresh access token: ${error.message}`, "GOOGLE_TOKEN_REFRESH_FAILED");
            }
        });
    }
    /**
     * Execute a Google API call with automatic retry on authentication errors
     * Handles token refresh and rotation transparently
     *
     * @param userEmail - User email for token management
     * @param deviceType - Device type for client configuration
     * @param apiCall - Async function that performs the API call
     * @returns Result of the API call
     */
    static executeWithRetry(userEmail, deviceType, apiCall) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            // Get the auth client (without preventive refresh)
            let client = yield GoogleAuthHelper.getAuthClientForUser(userEmail, deviceType);
            try {
                // Try the API call first
                return yield apiCall(client);
            }
            catch (error) {
                // Check if this is an authentication error that requires token refresh
                const errorMessage = ((_a = error.message) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || "";
                const errorCode = error.code;
                const isAuthError = errorCode === 401 ||
                    errorCode === 403 ||
                    errorMessage.includes("invalid_grant") ||
                    errorMessage.includes("invalid credentials") ||
                    (errorMessage.includes("token") && errorMessage.includes("expired")) ||
                    (errorMessage.includes("token") && errorMessage.includes("revoked"));
                if (!isAuthError) {
                    // Not an auth error, just throw it
                    throw error;
                }
                console.log(`🔄 Auth error detected for ${userEmail}, attempting token refresh and retry...`);
                // Use lock to prevent concurrent refresh attempts for the same user
                const lockKey = `${userEmail}:${deviceType}`;
                const existingLock = GoogleAuthHelper.refreshLocks.get(lockKey);
                if (existingLock) {
                    // Wait for ongoing refresh to complete
                    yield existingLock;
                    // Get fresh client after lock is released
                    client = yield GoogleAuthHelper.getAuthClientForUser(userEmail, deviceType);
                    // Retry with refreshed client
                    return yield apiCall(client);
                }
                // Create new lock for this refresh operation
                const refreshPromise = (() => __awaiter(this, void 0, void 0, function* () {
                    try {
                        // Create a new helper to perform the refresh
                        const helper = new GoogleAuthHelper(deviceType);
                        // Get and decrypt refresh token
                        const encryptedToken = yield db_helper_1.DbHelper.getGoogleRefreshToken(userEmail, deviceType);
                        if (!encryptedToken) {
                            throw new GoogleTokenError(`No refresh token found for ${userEmail}`, "GOOGLE_TOKEN_NOT_FOUND");
                        }
                        const refreshToken = crypto_helper_1.CryptoHelper.decrypt(encryptedToken);
                        helper.setCredentials(refreshToken);
                        // Perform the refresh
                        const refreshResult = yield helper.refreshAccessToken();
                        // Handle token rotation if Google returned a new refresh token
                        if (refreshResult.newRefreshToken) {
                            console.log(`💾 Saving rotated refresh token for ${userEmail} (${deviceType})`);
                            const encryptedNewToken = crypto_helper_1.CryptoHelper.encrypt(refreshResult.newRefreshToken);
                            yield db_helper_1.DbHelper.storeGoogleRefreshToken(userEmail, encryptedNewToken, deviceType);
                            console.log("✅ Rotated refresh token saved");
                        }
                    }
                    catch (refreshError) {
                        console.error("Failed to refresh token:", refreshError);
                        throw refreshError;
                    }
                    finally {
                        // Remove lock when done
                        GoogleAuthHelper.refreshLocks.delete(lockKey);
                    }
                }))();
                // Store the lock
                GoogleAuthHelper.refreshLocks.set(lockKey, refreshPromise);
                // Wait for refresh to complete
                yield refreshPromise;
                // Get fresh client with refreshed token
                client = yield GoogleAuthHelper.getAuthClientForUser(userEmail, deviceType);
                // Retry the API call with refreshed credentials
                console.log(`♻️  Retrying API call for ${userEmail} with refreshed token`);
                return yield apiCall(client);
            }
        });
    }
    // ============================================================================
    // STATIC METHODS - Database operations & authenticated client factory
    // ============================================================================
    /**
     * Get an authenticated OAuth2 client for a user (with refresh token from DB)
     * This is the main method for making API calls (Sheets, etc.)
     * Note: Token refresh happens lazily when API calls fail (handled by retry wrapper)
     */
    static getAuthClientForUser(userEmail_1) {
        return __awaiter(this, arguments, void 0, function* (userEmail, deviceType = "web") {
            try {
                // Get encrypted refresh token from user_google_tokens table
                const encryptedToken = yield db_helper_1.DbHelper.getGoogleRefreshToken(userEmail, deviceType);
                if (!encryptedToken) {
                    throw new GoogleTokenError(`No Google refresh token found for user ${userEmail} with device type ${deviceType}. User must re-authenticate.`, "GOOGLE_TOKEN_NOT_FOUND");
                }
                // Decrypt the refresh token
                const refreshToken = crypto_helper_1.CryptoHelper.decrypt(encryptedToken);
                // Create helper with the correct device type
                const helper = new GoogleAuthHelper(deviceType);
                // Set the refresh token credentials
                // OAuth2Client will automatically refresh when needed during API calls
                helper.setCredentials(refreshToken);
                return helper.getClient();
            }
            catch (error) {
                console.error("Error getting auth client for user:", error);
                // Re-throw GoogleTokenError as-is for proper handling upstream
                if (error instanceof GoogleTokenError) {
                    throw error;
                }
                // Wrap other errors
                throw new GoogleTokenError(`Failed to get Google auth client: ${error.message}`, "GOOGLE_AUTH_FAILED");
            }
        });
    }
    /**
     * Get user's spreadsheet ID from database
     */
    static getSpreadsheetIdForUser(userEmail) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const user = yield db_helper_1.DbHelper.getUserByEmail(userEmail);
                return (user === null || user === void 0 ? void 0 : user.spreadsheet_id) || null;
            }
            catch (error) {
                console.error("Error getting spreadsheet ID for user:", error);
                return null;
            }
        });
    }
    /**
     * Set spreadsheet ID for user
     */
    static setSpreadsheetIdForUser(userEmail, spreadsheetId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const user = yield db_helper_1.DbHelper.getUserByEmail(userEmail);
                if (!user) {
                    throw new Error("User not found");
                }
                yield db_helper_1.DbHelper.updateUser(userEmail, { spreadsheetId });
            }
            catch (error) {
                console.error("Error setting spreadsheet ID for user:", error);
                throw new Error(`Failed to set spreadsheet ID: ${error.message}`);
            }
        });
    }
}
exports.GoogleAuthHelper = GoogleAuthHelper;
exports.GoogleOAuthHelper = GoogleAuthHelper;
// ============================================================================
// RETRY WRAPPER - Execute API calls with automatic token refresh on auth errors
// ============================================================================
// Track ongoing refresh operations per user to avoid concurrent refreshes
GoogleAuthHelper.refreshLocks = new Map();
//# sourceMappingURL=auth.helper.js.map