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
exports.GoogleAuthHelper = void 0;
const googleapis_1 = require("googleapis");
const crypto_helper_1 = require("../auth/helpers/crypto.helper");
const DbHelper_1 = require("./DbHelper");
class GoogleAuthHelper {
    /**
     * Get Google OAuth2 client for authenticated user
     */
    static getAuthClientForUser(userEmail) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Get encrypted refresh token from database
                const encryptedToken = yield DbHelper_1.DbHelper.getGoogleRefreshToken(userEmail);
                if (!encryptedToken) {
                    throw new Error("No Google refresh token found for user");
                }
                // Decrypt the refresh token
                const refreshToken = crypto_helper_1.CryptoHelper.decrypt(encryptedToken);
                // Create OAuth2 client
                const oauth2Client = new googleapis_1.google.auth.OAuth2(process.env.CLIENT_ID, process.env.CLIENT_SECRET, process.env.REDIRECT_URI);
                // Set the refresh token
                oauth2Client.setCredentials({
                    refresh_token: refreshToken,
                });
                // Refresh access token if needed
                yield oauth2Client.getAccessToken();
                return oauth2Client;
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
                // First get the user to make sure they exist, then update
                const user = yield DbHelper_1.DbHelper.getUserByEmail(userEmail);
                if (!user) {
                    throw new Error("User not found");
                }
                // Use the spreadsheetId parameter in update - need to add this to interface
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
//# sourceMappingURL=GoogleAuthHelper.js.map