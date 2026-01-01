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
    static getClient() {
        if (!this.client) {
            this.client = new google_auth_library_1.OAuth2Client(process.env.CLIENT_ID, process.env.CLIENT_SECRET, process.env.REDIRECT_URI);
        }
        return this.client;
    }
    /**
     * Exchange authorization code for Google tokens
     */
    static exchangeCodeForTokens(params) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const client = this.getClient();
            try {
                // Prepare token request - only include codeVerifier if provided (for PKCE)
                const tokenRequest = {
                    code: params.authorizationCode,
                };
                // Only add codeVerifier if it's provided and not empty
                if (params.codeVerifier && params.codeVerifier.trim()) {
                    tokenRequest.codeVerifier = params.codeVerifier;
                }
                const { tokens } = yield client.getToken(tokenRequest);
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
                console.error("Error exchanging authorization code:", error);
                throw new Error(`Failed to exchange authorization code: ${error.message}`);
            }
        });
    }
    /**
     * Verify Google ID token and extract identity information
     */
    static verifyIdToken(idToken) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = this.getClient();
            try {
                const ticket = yield client.verifyIdToken({
                    idToken: idToken,
                    audience: process.env.CLIENT_ID,
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
                if (payload.aud !== process.env.CLIENT_ID) {
                    throw new Error("Invalid token audience");
                }
                if (!payload.sub || !payload.email) {
                    throw new Error("Missing required fields in ID token");
                }
                return {
                    googleSub: payload.sub,
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