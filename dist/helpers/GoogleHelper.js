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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleHelper = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const process_1 = __importDefault(require("process"));
const src_1 = require("@google-cloud/local-auth/build/src");
const googleapis_1 = require("googleapis");
class GoogleHelper {
    static authorize() {
        return __awaiter(this, void 0, void 0, function* () {
            let client;
            client = yield (0, src_1.authenticate)({
                scopes: this.SCOPES,
                keyfilePath: this.CREDENTIALS_PATH,
            });
            const content = yield fs_1.promises.readFile(this.CREDENTIALS_PATH, 'utf8');
            const keys = JSON.parse(content);
            const key = keys.installed || keys.web;
            const payload = JSON.stringify({
                type: 'authorized_user',
                client_id: key.client_id,
                client_secret: key.client_secret,
                refresh_token: client.credentials.refresh_token || '',
                access_token: client.credentials.access_token || ''
            });
            console.log(client);
            return payload;
        });
    }
    static parseAuthHeaders(headers) {
        const requiredHeaders = ['type', 'access_token', 'refresh_token', 'client_secret', 'client_id'];
        const missingHeaders = requiredHeaders.filter(header => !headers[header] || headers[header] === '');
        if (missingHeaders.length > 0) {
            throw new Error(`Missing or invalid authentication headers: ${missingHeaders.join(', ')}`);
        }
        return {
            type: headers.type,
            access_token: headers.access_token,
            refresh_token: headers.refresh_token,
            client_secret: headers.client_secret,
            client_id: headers.client_id
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
GoogleHelper.CREDENTIALS_PATH = path_1.default.join(process_1.default.cwd(), 'credentials.json');
//# sourceMappingURL=GoogleHelper.js.map