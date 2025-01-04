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
exports.GoogleHelper = void 0;
const googleapis_1 = require("googleapis");
class GoogleHelper {
    static authenticate(req) {
        return __awaiter(this, void 0, void 0, function* () {
            // console.log(this.oauth2Client._clientId, " ", this.oauth2Client._clientSecret," ", this.oauth2Client.redirectUri)
            const authorizationUrl = this.oauth2Client.generateAuthUrl({
                access_type: 'offline',
                scope: this.SCOPES,
                include_granted_scopes: true,
            });
            return authorizationUrl;
        });
    }
    static authorize(queryCode) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const code = decodeURIComponent(queryCode);
                const { tokens } = yield this.oauth2Client.getToken(code);
                return tokens;
            }
            catch (ex) {
                throw new Error(ex.message);
            }
        });
    }
    static parseAuthHeaders(headers) {
        // const requiredHeaders = ['type', 'access_token', 'refresh_token', 'client_secret', 'client_id'];
        const requiredHeaders = ['access_token', 'refresh_token'];
        const missingHeaders = requiredHeaders.filter(header => !headers[header] || headers[header] === '');
        if (missingHeaders.length > 0) {
            throw new Error(`Missing or invalid authentication headers: ${missingHeaders.join(', ')}`);
        }
        return {
            type: "authorized_user",
            access_token: headers.access_token,
            refresh_token: headers.refresh_token,
            client_secret: process.env.CLIENT_SECRET,
            client_id: process.env.CLIENT_ID,
        };
    }
    static get(auth, spreadsheetId, range) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!spreadsheetId && !range) {
                throw new Error('Missing or invalid parameters: spreadsheetId, range');
            }
            if (!spreadsheetId || spreadsheetId == "") {
                throw new Error('Missing or invalid parameter: spreadsheetId');
            }
            if (!range || range == "") {
                throw new Error('Missing or invalid parameter: range');
            }
            try {
                const sheets = googleapis_1.google.sheets({ version: 'v4', auth });
                const res = yield sheets.spreadsheets.values.get({
                    spreadsheetId: spreadsheetId,
                    range: range
                });
                const rows = res.data.values;
                if (!rows || rows.length === 0) {
                    console.log('No data found.');
                    return;
                }
                return rows;
            }
            catch (error) {
                console.error('Error fetching items:', error);
                throw new Error(`Failed to fetch items from Google Sheets. Error: ${error}`);
            }
        });
    }
    static update(auth, spreadsheetId, body) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!spreadsheetId && !body) {
                throw new Error('Missing or invalid parameters: spreadsheetId, range');
            }
            if (!spreadsheetId || spreadsheetId == "") {
                throw new Error('Missing or invalid parameter: spreadsheetId');
            }
            if (!body) {
                throw new Error('Missing or invalid parameter: range');
            }
            try {
                const sheets = googleapis_1.google.sheets({ version: 'v4', auth });
                const res = yield sheets.spreadsheets.values.batchUpdate({
                    spreadsheetId: spreadsheetId,
                    requestBody: body
                });
                if (res.status) {
                    return res;
                }
                else {
                    throw new Error();
                }
            }
            catch (error) {
                console.error('Error fetching items:', error);
                throw new Error(`Failed to fetch items from Google Sheets. Error: ${error}`);
            }
        });
    }
    static append(auth, spreadsheetId, range, body) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!spreadsheetId && !body) {
                throw new Error('Missing or invalid parameters: spreadsheetId, range');
            }
            if (!spreadsheetId || spreadsheetId == "") {
                throw new Error('Missing or invalid parameter: spreadsheetId');
            }
            if (!body) {
                throw new Error('Missing or invalid parameter: range');
            }
            try {
                const sheets = googleapis_1.google.sheets({ version: 'v4', auth });
                const res = yield sheets.spreadsheets.values.append({
                    spreadsheetId: spreadsheetId,
                    requestBody: body,
                    range: range,
                    valueInputOption: "RAW"
                });
                if (res.status) {
                    return res;
                }
                else {
                    throw new Error();
                }
            }
            catch (error) {
                console.error('Error fetching items:', error);
                throw new Error(`Failed to fetch items from Google Sheets. Error: ${error}`);
            }
        });
    }
}
exports.GoogleHelper = GoogleHelper;
GoogleHelper.SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
// public static oauth2Client = new google.auth.OAuth2(
//     "1034336371411-9bld4rsek32mmqhn30fh5ae7ou4asm37.apps.googleusercontent.com",
//     "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",
//     "http://localhost:8100/acceptLogin"
// );
GoogleHelper.oauth2Client = new googleapis_1.google.auth.OAuth2(process.env.CLIENT_ID, process.env.CLIENT_SECRET, process.env.AUTH_REDIRECT_URI);
//# sourceMappingURL=GoogleHelper.js.map