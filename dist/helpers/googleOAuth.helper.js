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
exports.GoogleOAuthHelper = void 0;
const google_auth_library_1 = require("google-auth-library");
class GoogleOAuthHelper {
    getClient() {
        return this.client;
    }
    loadWebClient() {
        console.log("Loading web OAuth2 client with params:", {
            clientId: process.env.CLIENT_ID_WEB,
            clientSecret: process.env.CLIENT_SECRET,
            redirectUri: process.env.REDIRECT_URI_WEB,
        });
        this.client = new google_auth_library_1.OAuth2Client(process.env.CLIENT_ID_WEB, process.env.CLIENT_SECRET, process.env.REDIRECT_URI_WEB);
    }
    loadIOSClient() {
        this.client = new google_auth_library_1.OAuth2Client({
            client_id: process.env.CLIENT_ID_IOS,
            redirectUri: process.env.REDIRECT_URI_IOS,
        });
    }
    loadAndroidClient() {
        console.log("Loading Android OAuth2 client with params:", {
            clientId: process.env.CLIENT_ID_ANDROID,
            redirectUri: process.env.REDIRECT_URI_ANDROID || process.env.REDIRECT_URI_IOS,
        });
        this.client = new google_auth_library_1.OAuth2Client({
            client_id: process.env.CLIENT_ID_ANDROID,
            redirectUri: process.env.REDIRECT_URI_ANDROID || process.env.REDIRECT_URI_IOS,
        });
    }
    constructor(deviceType) {
        console.log("Initializing GoogleOAuthHelper for device type:", deviceType);
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
                    console.log("Using PKCE code verifier for token exchange:", tokenRequest.codeVerifier);
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
            console.log("Verifying ID token:", idToken, "for client", this.client._clientId);
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
}
exports.GoogleOAuthHelper = GoogleOAuthHelper;
//# sourceMappingURL=googleOAuth.helper.js.map