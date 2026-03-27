"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const dotenv = __importStar(require("dotenv"));
const template_1 = require("../../assets/template");
dotenv.config({ path: '.env.local' });
function createGoogleSheetsError(message, error) {
    const wrappedError = new Error(`${message}. Error: ${(error === null || error === void 0 ? void 0 : error.message) || String(error)}`);
    Object.assign(wrappedError, {
        code: error === null || error === void 0 ? void 0 : error.code,
        status: error === null || error === void 0 ? void 0 : error.status,
        response: error === null || error === void 0 ? void 0 : error.response,
        errors: error === null || error === void 0 ? void 0 : error.errors,
        cause: error,
    });
    return wrappedError;
}
class GoogleHelper {
    static authenticate(req) {
        return __awaiter(this, void 0, void 0, function* () {
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
                const { user_id, email } = yield this.oauth2Client.getTokenInfo(tokens.access_token);
                return { refreshToken: tokens.refresh_token, user_id, email };
            }
            catch (ex) {
                console.log(ex);
                throw new Error(ex);
            }
        });
    }
    static checkCredentials(auth) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                var OAuth2 = googleapis_1.google.auth.OAuth2;
                var oauth2Client = new OAuth2(auth.client_id, auth.client_secret, "");
                oauth2Client.setCredentials({
                    refresh_token: auth.refresh_token,
                });
                var oauth2 = googleapis_1.google.oauth2({
                    auth: oauth2Client,
                    version: 'v2'
                });
                const { data } = yield oauth2.userinfo.get();
                return data;
            }
            catch (ex) {
                console.log(ex);
                throw new Error(ex);
            }
        });
    }
    static parseAuthHeaders(headers) {
        const requiredHeaders = ['refresh_token'];
        const missingHeaders = requiredHeaders.filter(header => !headers[header] || headers[header] === '');
        if (missingHeaders.length > 0) {
            throw new Error(`Missing or invalid authentication headers: ${missingHeaders.join(', ')}`);
        }
        return {
            type: "authorized_user",
            refresh_token: headers.refresh_token,
            client_secret: process.env.CLIENT_SECRET,
            client_id: process.env.CLIENT_ID
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
                throw createGoogleSheetsError('Failed to fetch items from Google Sheets', error);
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
                throw new Error('Missing or invalid parameter: body');
            }
            try {
                const sheets = googleapis_1.google.sheets({ version: 'v4', auth });
                const res = yield sheets.spreadsheets.values.batchUpdate({
                    spreadsheetId: spreadsheetId,
                    requestBody: {
                        valueInputOption: "RAW",
                        data: body
                    }
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
                throw createGoogleSheetsError('Failed to fetch items from Google Sheets', error);
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
                throw createGoogleSheetsError('Failed to fetch items from Google Sheets', error);
            }
        });
    }
    /**
     * Esegue operazioni strutturali sullo spreadsheet (rinomina sheet, aggiungi sheet, ecc.)
     * Usa spreadsheets.batchUpdate (NON values.batchUpdate)
     */
    static batchUpdateSpreadsheet(auth, spreadsheetId, requests) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!spreadsheetId) {
                throw new Error('Missing or invalid parameter: spreadsheetId');
            }
            if (!requests || requests.length === 0) {
                throw new Error('Missing or invalid parameter: requests');
            }
            try {
                const sheets = googleapis_1.google.sheets({ version: 'v4', auth });
                const res = yield sheets.spreadsheets.batchUpdate({
                    spreadsheetId,
                    requestBody: { requests },
                });
                return res;
            }
            catch (error) {
                console.error('Error in batchUpdateSpreadsheet:', error);
                throw createGoogleSheetsError('Failed batchUpdate on spreadsheet', error);
            }
        });
    }
    /**
     * Ottiene i metadati dello spreadsheet (inclusi sheetId per ogni tab)
     */
    static getSpreadsheetMeta(auth, spreadsheetId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!spreadsheetId) {
                throw new Error('Missing or invalid parameter: spreadsheetId');
            }
            try {
                const sheets = googleapis_1.google.sheets({ version: 'v4', auth });
                const res = yield sheets.spreadsheets.get({
                    spreadsheetId,
                    fields: 'sheets.properties',
                });
                return res.data.sheets || [];
            }
            catch (error) {
                console.error('Error getting spreadsheet meta:', error);
                throw createGoogleSheetsError('Failed to get spreadsheet metadata', error);
            }
        });
    }
    static create(auth, userEmail) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!userEmail) {
                throw new Error('Missing or invalid parameter: userEmail');
            }
            try {
                const sheets = googleapis_1.google.sheets({ version: 'v4', auth });
                const res = yield sheets.spreadsheets.create({
                    requestBody: template_1.template
                });
                return res;
            }
            catch (error) {
                console.error('Error fetching items:', error);
                throw createGoogleSheetsError('Failed to fetch items from Google Sheets', error);
            }
        });
    }
}
exports.GoogleHelper = GoogleHelper;
GoogleHelper.SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/userinfo'];
GoogleHelper.oauth2Client = new googleapis_1.google.auth.OAuth2(process.env.CLIENT_ID, process.env.CLIENT_SECRET, process.env.REDIRECT_URI);
//# sourceMappingURL=sheets.helper.js.map