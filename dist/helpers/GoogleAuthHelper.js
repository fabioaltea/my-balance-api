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
exports.GoogleOAuthHelper = exports.GoogleAuthHelper = void 0;
const google_auth_library_1 = require("google-auth-library");
const crypto_helper_1 = require("./crypto.helper");
const DbHelper_1 = require("./DbHelper");
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
     */
    refreshAccessToken() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { token } = yield this.client.getAccessToken();
                return token || null;
            }
            catch (error) {
                console.error("Error refreshing access token:", error);
                throw new Error(`Failed to refresh access token: ${error.message}`);
            }
        });
    }
    // ============================================================================
    // STATIC METHODS - Database operations & authenticated client factory
    // ============================================================================
    /**
     * Get an authenticated OAuth2 client for a user (with refresh token from DB)
     * This is the main method for making API calls (Sheets, etc.)
     */
    static getAuthClientForUser(userEmail_1) {
        return __awaiter(this, arguments, void 0, function* (userEmail, deviceType = "web") {
            try {
                // Get encrypted refresh token from user_google_tokens table
                const encryptedToken = yield DbHelper_1.DbHelper.getGoogleRefreshToken(userEmail, deviceType);
                if (!encryptedToken) {
                    throw new Error(`No Google refresh token found for user ${userEmail} with device type ${deviceType}`);
                }
                // Decrypt the refresh token
                const refreshToken = crypto_helper_1.CryptoHelper.decrypt(encryptedToken);
                // Create helper with the correct device type
                const helper = new GoogleAuthHelper(deviceType);
                // Set the refresh token credentials
                helper.setCredentials(refreshToken);
                // Refresh access token to ensure it's valid
                yield helper.refreshAccessToken();
                return helper.getClient();
            }
            catch (error) {
                console.error("Error getting auth client for user:", error);
                throw new Error(`Failed to get Google auth client: ${error.message}`);
            }
        });
    }
    /**
     * Get user's spreadsheet ID from database
     */
    static getSpreadsheetIdForUser(userEmail) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const user = yield DbHelper_1.DbHelper.getUserByEmail(userEmail);
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
                const user = yield DbHelper_1.DbHelper.getUserByEmail(userEmail);
                if (!user) {
                    throw new Error("User not found");
                }
                yield DbHelper_1.DbHelper.updateUser(userEmail, { spreadsheetId });
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
//# sourceMappingURL=GoogleAuthHelper.js.map