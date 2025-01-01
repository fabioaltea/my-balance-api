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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const fs_1 = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const process_1 = __importDefault(require("process"));
const src_1 = require("@google-cloud/local-auth/build/src");
const googleapis_1 = require("googleapis");
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
const TOKEN_PATH = path_1.default.join(process_1.default.cwd(), 'token.json');
const CREDENTIALS_PATH = path_1.default.join(process_1.default.cwd(), 'credentials.json');
function loadSavedCredentialsIfExist() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const content = yield fs_1.promises.readFile(TOKEN_PATH, 'utf8');
            const credentials = JSON.parse(content);
            return googleapis_1.google.auth.fromJSON(credentials);
        }
        catch (err) {
            return null;
        }
    });
}
function saveCredentials(client) {
    return __awaiter(this, void 0, void 0, function* () {
        const content = yield fs_1.promises.readFile(CREDENTIALS_PATH, 'utf8');
        const keys = JSON.parse(content);
        const key = keys.installed || keys.web;
        const payload = JSON.stringify({
            type: 'authorized_user',
            client_id: key.client_id,
            client_secret: key.client_secret,
            refresh_token: client.credentials.refresh_token,
        });
        yield fs_1.default.writeFile(TOKEN_PATH, payload, (err) => {
            if (err)
                throw err;
        });
    });
}
function authorize() {
    return __awaiter(this, void 0, void 0, function* () {
        let client = yield loadSavedCredentialsIfExist();
        if (client) {
            return client;
        }
        client = yield (0, src_1.authenticate)({
            scopes: SCOPES,
            keyfilePath: CREDENTIALS_PATH,
        });
        if (client.credentials) {
            yield saveCredentials(client);
        }
        return client;
    });
}
function listMajors(auth) {
    return __awaiter(this, void 0, void 0, function* () {
        const sheets = googleapis_1.google.sheets({ version: 'v4', auth });
        const res = yield sheets.spreadsheets.values.get({
            spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
            range: 'Class Data!A2:E',
        });
        const rows = res.data.values;
        if (!rows || rows.length === 0) {
            console.log('No data found.');
            return;
        }
        console.log('Name, Major:');
        rows.forEach((row) => {
            // Print columns A and E, which correspond to indices 0 and 4.
            console.log(`${row[0]}, ${row[4]}`);
        });
        return rows;
    });
}
const app = (0, express_1.default)();
const port = process_1.default.env.PORT || 8080;
app.get('/', (req, res) => {
    authorize().then((auth) => {
        listMajors(auth).then((majors) => {
            console.log(majors);
            return res.send(majors.toString());
        });
    }).catch(() => {
        return res.send("error");
    });
});
app.get('/ping', (_req, res) => {
    return res.send('pong 🏓');
});
app.listen(port, () => {
    return console.log(`Server is listening on ${port}`);
});
//# sourceMappingURL=index.js.map