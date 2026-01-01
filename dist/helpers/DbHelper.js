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
const base64url_1 = __importDefault(require("base64url/dist/base64url"));
class DbHelper {
    static getData() {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield DbHelper._pool.connect();
            try {
                const { rows } = yield client.query("SELECT * FROM users");
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
                const { rows } = yield client.query("SELECT token, spreadsheet_id FROM users WHERE user_email = $1 AND pin = $2", [userEmail, pin]);
                if (rows.length < 1) {
                    return null;
                }
                else {
                    return rows[0];
                }
            }
            catch (error) {
                console.error("Error retrieving credentials:", error);
                throw new Error("Error retrieving credentials");
            }
            finally {
                client.release();
            }
        });
    }
    static saveAuthChallenge(userEmail, challenge) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield DbHelper._pool.connect();
            try {
                yield client.query(`UPDATE users SET webauthn_challenge = $1, webauthn_challenge_created = NOW() WHERE user_email = $2`, [challenge, userEmail]);
            }
            catch (error) {
                console.error("Error saving credentials:", error);
                throw new Error("Error saving credentials");
            }
            finally {
                client.release();
            }
        });
    }
    static getUserCredentials(userEmail, clientCredentialId) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield DbHelper._pool.connect();
            try {
                const { rows } = yield client.query(`SELECT credentials.credential_id, credentials.cred_public_key, credentials.counter, users.token FROM credentials JOIN users ON credentials.user_id = users.user_email WHERE users.user_email = $1 AND credentials.credential_id = $2`, [userEmail, clientCredentialId]);
                if (rows.length < 1) {
                    return null;
                }
                else {
                    return rows.map((row) => ({
                        credentialID: row.credential_id, // Keep as base64url string
                        credentialPublicKey: base64url_1.default.toBuffer(row.cred_public_key), // Convert base64url string to Buffer
                        counter: row.counter,
                        token: row.token,
                    }));
                }
            }
            catch (error) {
                console.error("Error retrieving credentials:", error);
                throw new Error("Error retrieving credentials");
            }
            finally {
                client.release();
            }
        });
    }
    static saveUserToken(userEmail, token) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield DbHelper._pool.connect();
            try {
                const r = yield client.query(`UPDATE users SET token = $1 WHERE user_email = $2`, [token, userEmail]);
            }
            catch (error) {
                console.error("Error saving user token:", error);
                throw new Error("Error saving user token");
            }
            finally {
                client.release();
            }
        });
    }
    static saveUserCredentials(userEmail, credentialID, credentialPublicKey, counter) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield DbHelper._pool.connect();
            try {
                yield client.query(`INSERT INTO credentials (credential_id, cred_public_key, counter, user_id) VALUES ($1, $2, $3, $4)`, [credentialID, credentialPublicKey, counter, userEmail]);
            }
            catch (error) {
                console.error("Error saving credentials:", error);
                throw new Error("Error saving credentials");
            }
            finally {
                client.release();
            }
        });
    }
    static getAuthChallenge(userEmail) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("DbHelper.getAuthChallenge called for user:", userEmail);
            const client = yield DbHelper._pool.connect();
            try {
                const { rows } = yield client.query(`SELECT webauthn_challenge, webauthn_challenge_created FROM users WHERE user_email = $1`, [userEmail]);
                if (rows.length < 1) {
                    return null;
                }
                else {
                    return rows[0];
                }
            }
            catch (error) {
                console.error("Error getting Auth challengeq:", error);
                throw new Error("Error getting Auth challenge");
            }
            finally {
                client.release();
            }
        });
    }
    static insertUser(userEmail, spreadsheetId) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield DbHelper._pool.connect();
            try {
                yield client.query(`INSERT INTO users (user_email, spreadsheet_id) VALUES ($1, $2) RETURNING *`, [userEmail, spreadsheetId]);
            }
            catch (error) {
                console.error("Error inserting user:", error);
                throw new Error("Error inserting user");
            }
            finally {
                client.release();
            }
        });
    }
    static updateUserLastAccess(userEmail) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield DbHelper._pool.connect();
            try {
                yield client.query(`UPDATE users SET last_access = NOW() WHERE user_email = $1`, [userEmail]);
            }
            catch (error) {
                console.error("Error updating user last access:", error);
                throw new Error("Error updating user last access");
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
    // === NEW AUTHENTICATION METHODS ===
    /**
     * Get user by email
     */
    static getUserByEmail(email) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield DbHelper._pool.connect();
            try {
                const { rows } = yield client.query(`SELECT id, user_email, google_sub, email_verified, 
                credential_public_key, counter, created_at, last_access, spreadsheet_id 
         FROM users WHERE user_email = $1`, [email]);
                return rows.length > 0 ? rows[0] : null;
            }
            catch (error) {
                console.error("Error getting user by email:", error);
                throw new Error("Error getting user by email");
            }
            finally {
                client.release();
            }
        });
    }
    /**
     * Get user by ID
     */
    static getUserById(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield DbHelper._pool.connect();
            try {
                const { rows } = yield client.query(`SELECT id, user_email, google_sub, email_verified, 
                credential_public_key, counter, created_at, last_access, spreadsheet_id 
         FROM users WHERE id = $1`, [userId]);
                return rows.length > 0 ? rows[0] : null;
            }
            catch (error) {
                console.error("Error getting user by ID:", error);
                throw new Error("Error getting user by ID");
            }
            finally {
                client.release();
            }
        });
    }
    /**
     * Create new user
     */
    static createUser(userData) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield DbHelper._pool.connect();
            try {
                const { rows } = yield client.query(`INSERT INTO users (user_email, google_sub, email_verified, created_at, last_access) 
         VALUES ($1, $2, $3, NOW(), NOW()) 
         RETURNING id, user_email, google_sub, email_verified, created_at, last_access`, [userData.email, userData.googleSub, userData.emailVerified]);
                return rows[0];
            }
            catch (error) {
                console.error("Error creating user:", error);
                throw new Error("Error creating user");
            }
            finally {
                client.release();
            }
        });
    }
    /**
     * Update user information
     */
    static updateUser(userEmail, userData) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield DbHelper._pool.connect();
            try {
                const updateFields = [];
                const values = [];
                let paramIndex = 1;
                if (userData.emailVerified !== undefined) {
                    updateFields.push(`email_verified = $${paramIndex++}`);
                    values.push(userData.emailVerified);
                }
                if (userData.googleSub !== undefined) {
                    updateFields.push(`google_sub = $${paramIndex++}`);
                    values.push(userData.googleSub);
                }
                if (userData.spreadsheetId !== undefined) {
                    updateFields.push(`spreadsheet_id = $${paramIndex++}`);
                    values.push(userData.spreadsheetId);
                }
                updateFields.push(`last_access = NOW()`);
                values.push(userEmail);
                yield client.query(`UPDATE users SET ${updateFields.join(", ")} WHERE user_email = $${paramIndex}`, values);
            }
            catch (error) {
                console.error("Error updating user:", error);
                throw new Error("Error updating user");
            }
            finally {
                client.release();
            }
        });
    }
    /**
     * Store encrypted Google refresh token
     */
    static storeGoogleRefreshToken(userEmail, encryptedToken) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield DbHelper._pool.connect();
            try {
                yield client.query(`UPDATE users SET google_refresh_token = $1 WHERE user_email = $2`, [encryptedToken, userEmail]);
            }
            catch (error) {
                console.error("Error storing Google refresh token:", error);
                throw new Error("Error storing Google refresh token");
            }
            finally {
                client.release();
            }
        });
    }
    /**
     * Get encrypted Google refresh token
     */
    static getGoogleRefreshToken(userEmail) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield DbHelper._pool.connect();
            try {
                const { rows } = yield client.query(`SELECT google_refresh_token FROM users WHERE user_email = $1`, [userEmail]);
                return rows.length > 0 ? rows[0].google_refresh_token : null;
            }
            catch (error) {
                console.error("Error getting Google refresh token:", error);
                throw new Error("Error getting Google refresh token");
            }
            finally {
                client.release();
            }
        });
    }
    /**
     * Create session
     */
    static createSession(sessionData) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield DbHelper._pool.connect();
            try {
                const { rows } = yield client.query(`INSERT INTO sessions (user_email, device_id, refresh_token_hash, expires_at, scopes, created_at) 
         VALUES ($1, $2, $3, $4, $5, NOW()) 
         RETURNING id`, [sessionData.userEmail, sessionData.deviceId, sessionData.refreshTokenHash,
                    sessionData.expiresAt, JSON.stringify(sessionData.scopes)]);
                return rows[0].id;
            }
            catch (error) {
                console.error("Error creating session:", error);
                throw new Error("Error creating session");
            }
            finally {
                client.release();
            }
        });
    }
    /**
     * Get session by device ID
     */
    static getSessionByDeviceId(deviceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield DbHelper._pool.connect();
            try {
                const { rows } = yield client.query(`SELECT id, user_email, device_id, refresh_token_hash, expires_at, scopes, created_at 
         FROM sessions WHERE device_id = $1 AND expires_at > NOW() 
         ORDER BY created_at DESC LIMIT 1`, [deviceId]);
                if (rows.length > 0) {
                    const row = rows[0];
                    return Object.assign(Object.assign({}, row), { scopes: JSON.parse(row.scopes || '[]') });
                }
                return null;
            }
            catch (error) {
                console.error("Error getting session:", error);
                throw new Error("Error getting session");
            }
            finally {
                client.release();
            }
        });
    }
    /**
     * Update session
     */
    static updateSession(sessionId, updateData) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield DbHelper._pool.connect();
            try {
                const updateFields = [];
                const values = [];
                let paramIndex = 1;
                if (updateData.refreshTokenHash !== undefined) {
                    updateFields.push(`refresh_token_hash = $${paramIndex++}`);
                    values.push(updateData.refreshTokenHash);
                }
                if (updateData.expiresAt !== undefined) {
                    updateFields.push(`expires_at = $${paramIndex++}`);
                    values.push(updateData.expiresAt);
                }
                values.push(sessionId);
                yield client.query(`UPDATE sessions SET ${updateFields.join(", ")} WHERE id = $${paramIndex}`, values);
            }
            catch (error) {
                console.error("Error updating session:", error);
                throw new Error("Error updating session");
            }
            finally {
                client.release();
            }
        });
    }
    /**
     * Revoke session by device ID
     */
    static revokeSession(deviceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield DbHelper._pool.connect();
            try {
                yield client.query(`UPDATE sessions SET expires_at = NOW() WHERE device_id = $1`, [deviceId]);
            }
            catch (error) {
                console.error("Error revoking session:", error);
                throw new Error("Error revoking session");
            }
            finally {
                client.release();
            }
        });
    }
    /**
     * Update WebAuthn counter
     */
    static updateWebAuthnCounter(userId, newCounter) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield DbHelper._pool.connect();
            try {
                yield client.query(`UPDATE users SET webauthn_counter = $1 WHERE id = $2`, [newCounter, userId]);
            }
            catch (error) {
                console.error("Error updating WebAuthn counter:", error);
                throw new Error("Error updating WebAuthn counter");
            }
            finally {
                client.release();
            }
        });
    }
    /**
     * Clean expired sessions
     */
    static cleanExpiredSessions() {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield DbHelper._pool.connect();
            try {
                yield client.query(`DELETE FROM sessions WHERE expires_at < NOW()`);
            }
            catch (error) {
                console.error("Error cleaning expired sessions:", error);
                throw new Error("Error cleaning expired sessions");
            }
            finally {
                client.release();
            }
        });
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