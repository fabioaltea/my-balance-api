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
exports.DbHelper = void 0;
const pg_1 = require("pg");
const crypto_js_1 = __importDefault(require("crypto-js"));
class DbHelper {
    static getData() {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield DbHelper._pool.connect();
            try {
                const { rows } = yield client.query('SELECT * FROM users');
                console.log(rows);
                return rows;
            }
            finally {
                client.release();
            }
        });
    }
    static getDbCredentials(userEmail, pin) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield DbHelper._pool.connect();
            try {
                const { rows } = yield client.query('SELECT token, spreadsheet_id FROM users WHERE user_email = $1 AND pin = $2', [userEmail, pin]);
                if (rows.length < 1) {
                    return null;
                }
                else {
                    return rows[0];
                }
            }
            catch (error) {
                console.error('Error retrieving credentials:', error);
                throw new Error('Error retrieving credentials');
            }
            finally {
                client.release();
            }
        });
    }
    static decryptToken(encryptedToken, secretKey) {
        const bytes = crypto_js_1.default.AES.decrypt(encryptedToken, secretKey);
        const decrypted = bytes.toString(crypto_js_1.default.enc.Utf8);
        return decrypted;
    }
    static hashPin(pin) {
        const hash = crypto_js_1.default.SHA256(pin);
        return hash.toString(crypto_js_1.default.enc.Hex);
    }
}
exports.DbHelper = DbHelper;
DbHelper._pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    },
});
//# sourceMappingURL=DbHelper.js.map