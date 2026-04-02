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
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DbHelper = void 0;
const pg_1 = require("pg");
const crypto_js_1 = __importDefault(require("crypto-js"));
const base64url_1 = __importDefault(require("base64url/dist/base64url"));
// Enable SSL only for production databases (Neon, etc.)
const useSSL = ((_a = process.env.DATABASE_URL) === null || _a === void 0 ? void 0 : _a.includes('neon.tech')) ||
    ((_b = process.env.DATABASE_URL) === null || _b === void 0 ? void 0 : _b.includes('sslmode=require')) ||
    process.env.NODE_ENV === 'production';
class DbHelper {
    static getData() {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield DbHelper._pool.connect();
            try {
                const { rows } = yield client.query('SELECT * FROM users');
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
    static saveAuthChallenge(userEmail, challenge) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield DbHelper._pool.connect();
            try {
                yield client.query(`UPDATE users SET webauthn_challenge = $1, webauthn_challenge_created = NOW() WHERE user_email = $2`, [challenge, userEmail]);
            }
            catch (error) {
                console.error('Error saving credentials:', error);
                throw new Error('Error saving credentials');
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
                console.error('Error retrieving credentials:', error);
                throw new Error('Error retrieving credentials');
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
                const r = yield client.query(`UPDATE users SET token = $1 WHERE user_email = $2`, [
                    token,
                    userEmail,
                ]);
            }
            catch (error) {
                console.error('Error saving user token:', error);
                throw new Error('Error saving user token');
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
                console.error('Error saving credentials:', error);
                throw new Error('Error saving credentials');
            }
            finally {
                client.release();
            }
        });
    }
    static getAuthChallenge(userEmail) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('DbHelper.getAuthChallenge called for user:', userEmail);
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
                console.error('Error getting Auth challengeq:', error);
                throw new Error('Error getting Auth challenge');
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
                console.error('Error inserting user:', error);
                throw new Error('Error inserting user');
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
                console.error('Error updating user last access:', error);
                throw new Error('Error updating user last access');
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
                const { rows } = yield client.query(`SELECT id, user_email, user_name, user_picture, email_verified,
                credential_public_key, counter, created_at, last_access,
                spreadsheet_id, shortcut_key, push_token
         FROM users WHERE user_email = $1`, [email]);
                return rows.length > 0 ? rows[0] : null;
            }
            catch (error) {
                console.error('Error getting user by email:', error);
                throw new Error('Error getting user by email');
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
                const { rows } = yield client.query(`SELECT id, user_email, email_verified, 
                credential_public_key, counter, created_at, last_access, spreadsheet_id 
         FROM users WHERE id = $1`, [userId]);
                return rows.length > 0 ? rows[0] : null;
            }
            catch (error) {
                console.error('Error getting user by ID:', error);
                throw new Error('Error getting user by ID');
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
                const { rows } = yield client.query(`INSERT INTO users (user_email, user_name, user_picture, email_verified, created_at, last_access)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         RETURNING id, user_email, user_name, user_picture, email_verified, created_at, last_access`, [userData.email, userData.name, userData.picture, userData.emailVerified]);
                return rows[0];
            }
            catch (error) {
                console.error('Error creating user:', error);
                throw new Error('Error creating user');
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
                if (userData.name !== undefined) {
                    updateFields.push(`user_name = $${paramIndex++}`);
                    values.push(userData.name);
                }
                if (userData.picture !== undefined) {
                    updateFields.push(`user_picture = $${paramIndex++}`);
                    values.push(userData.picture);
                }
                if (userData.emailVerified !== undefined) {
                    updateFields.push(`email_verified = $${paramIndex++}`);
                    values.push(userData.emailVerified);
                }
                if (userData.spreadsheetId !== undefined) {
                    updateFields.push(`spreadsheet_id = $${paramIndex++}`);
                    values.push(userData.spreadsheetId);
                }
                updateFields.push(`last_access = NOW()`);
                values.push(userEmail);
                yield client.query(`UPDATE users SET ${updateFields.join(', ')} WHERE user_email = $${paramIndex}`, values);
            }
            catch (error) {
                console.error('Error updating user:', error);
                throw new Error('Error updating user');
            }
            finally {
                client.release();
            }
        });
    }
    /**
     * Store encrypted Google refresh token in user_google_tokens table
     * Uses UPSERT to ensure only one token per user+device_type
     */
    static storeGoogleRefreshToken(userEmail_1, encryptedToken_1) {
        return __awaiter(this, arguments, void 0, function* (userEmail, encryptedToken, deviceType = 'web', productName = 'MyBalance') {
            const client = yield DbHelper._pool.connect();
            try {
                yield client.query(`INSERT INTO user_google_tokens (user_email, device_type, product_name, google_refresh_token, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (user_email, device_type, product_name)
         DO UPDATE SET google_refresh_token = $4, updated_at = NOW()`, [userEmail, deviceType, productName, encryptedToken]);
            }
            catch (error) {
                console.error('Error storing Google refresh token:', error);
                throw new Error('Error storing Google refresh token');
            }
            finally {
                client.release();
            }
        });
    }
    /**
     * Get encrypted Google refresh token from user_google_tokens table
     */
    static getGoogleRefreshToken(userEmail_1) {
        return __awaiter(this, arguments, void 0, function* (userEmail, deviceType = 'web', productName = 'MyBalance') {
            var _a;
            const client = yield DbHelper._pool.connect();
            try {
                const { rows } = yield client.query(`SELECT google_refresh_token FROM user_google_tokens
         WHERE user_email = $1 AND device_type = $2 AND product_name = $3`, [userEmail, deviceType, productName]);
                return ((_a = rows[0]) === null || _a === void 0 ? void 0 : _a.google_refresh_token) || null;
            }
            catch (error) {
                console.error('Error getting Google refresh token:', error);
                throw new Error('Error getting Google refresh token');
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
                const { rows } = yield client.query(`INSERT INTO sessions (user_email, device_id, scopes, device_type, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING id`, [
                    sessionData.userEmail,
                    sessionData.deviceId,
                    JSON.stringify(sessionData.scopes),
                    sessionData.deviceType || 'web',
                ]);
                return rows[0].id;
            }
            catch (error) {
                console.error('Error creating session:', error);
                throw new Error('Error creating session');
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
                const { rows } = yield client.query(`SELECT id, user_email, device_id, scopes, device_type, created_at
         FROM sessions WHERE device_id = $1
         ORDER BY created_at DESC LIMIT 1`, [deviceId]);
                if (rows.length > 0) {
                    const row = rows[0];
                    // Parse scopes - handle both string and already-parsed array
                    let parsedScopes = [];
                    try {
                        if (typeof row.scopes === 'string') {
                            parsedScopes = JSON.parse(row.scopes);
                        }
                        else if (Array.isArray(row.scopes)) {
                            parsedScopes = row.scopes;
                        }
                    }
                    catch (error) {
                        console.error('Error parsing scopes:', error, 'Raw value:', row.scopes);
                        parsedScopes = [];
                    }
                    return Object.assign(Object.assign({}, row), { scopes: parsedScopes });
                }
                return null;
            }
            catch (error) {
                console.error('Error getting session:', error);
                throw new Error('Error getting session');
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
                if (updateData.scopes !== undefined) {
                    updateFields.push(`scopes = $${paramIndex++}`);
                    values.push(JSON.stringify(updateData.scopes));
                }
                if (updateData.deviceType !== undefined) {
                    updateFields.push(`device_type = $${paramIndex++}`);
                    values.push(updateData.deviceType);
                }
                if (updateFields.length === 0) {
                    return; // Nothing to update
                }
                values.push(sessionId);
                yield client.query(`UPDATE sessions SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`, values);
            }
            catch (error) {
                console.error('Error updating session:', error);
                throw new Error('Error updating session');
            }
            finally {
                client.release();
            }
        });
    }
    /**
     * Revoke session by device ID (deletes the session)
     */
    static revokeSession(deviceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield DbHelper._pool.connect();
            try {
                yield client.query(`DELETE FROM sessions WHERE device_id = $1`, [deviceId]);
            }
            catch (error) {
                console.error('Error revoking session:', error);
                throw new Error('Error revoking session');
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
                yield client.query(`UPDATE users SET webauthn_counter = $1 WHERE id = $2`, [
                    newCounter,
                    userId,
                ]);
            }
            catch (error) {
                console.error('Error updating WebAuthn counter:', error);
                throw new Error('Error updating WebAuthn counter');
            }
            finally {
                client.release();
            }
        });
    }
    /**
     * Clean old sessions (older than 30 days)
     */
    static cleanOldSessions() {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield DbHelper._pool.connect();
            try {
                yield client.query(`DELETE FROM sessions WHERE created_at < NOW() - INTERVAL '30 days'`);
            }
            catch (error) {
                console.error('Error cleaning old sessions:', error);
                throw new Error('Error cleaning old sessions');
            }
            finally {
                client.release();
            }
        });
    }
    // === SHORTCUT KEY METHODS ===
    /**
     * Update shortcut key for user
     */
    static updateShortcutKey(email, shortcutKey) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield DbHelper._pool.connect();
            try {
                yield client.query(`UPDATE users SET shortcut_key = $1 WHERE user_email = $2`, [
                    shortcutKey,
                    email,
                ]);
            }
            catch (error) {
                console.error('Error updating shortcut key:', error);
                throw new Error('Error updating shortcut key');
            }
            finally {
                client.release();
            }
        });
    }
    /**
     * Get user by shortcut key
     */
    static getUserByShortcutKey(shortcutKey) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield DbHelper._pool.connect();
            try {
                const { rows } = yield client.query(`SELECT id, user_email as email, email_verified,
                spreadsheet_id, shortcut_key, push_token, created_at, last_access
         FROM users WHERE shortcut_key = $1`, [shortcutKey]);
                return rows.length > 0 ? rows[0] : null;
            }
            catch (error) {
                console.error('Error getting user by shortcut key:', error);
                throw new Error('Error getting user by shortcut key');
            }
            finally {
                client.release();
            }
        });
    }
    // === PUSH NOTIFICATIONS METHODS ===
    /**
     * Save push notification token for user
     */
    static savePushToken(email, pushToken) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield DbHelper._pool.connect();
            try {
                yield client.query(`UPDATE users SET push_token = $1 WHERE user_email = $2`, [
                    pushToken,
                    email,
                ]);
            }
            catch (error) {
                console.error('Error saving push token:', error);
                throw new Error('Error saving push token');
            }
            finally {
                client.release();
            }
        });
    }
    /**
     * Remove push notification token for user
     */
    static removePushToken(email) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield DbHelper._pool.connect();
            try {
                yield client.query(`UPDATE users SET push_token = NULL WHERE user_email = $1`, [email]);
            }
            catch (error) {
                console.error('Error removing push token:', error);
                throw new Error('Error removing push token');
            }
            finally {
                client.release();
            }
        });
    }
    // === USER PRODUCTS / SCHEMA VERSION METHODS ===
    /**
     * Get user_products row for a user+product
     */
    static getUserProduct(userEmail_1) {
        return __awaiter(this, arguments, void 0, function* (userEmail, productName = 'MyBalance') {
            var _a;
            const client = yield DbHelper._pool.connect();
            try {
                const { rows } = yield client.query(`SELECT spreadsheet_id, schema_version FROM user_products
         WHERE user_email = $1 AND product_name = $2`, [userEmail, productName]);
                return (_a = rows[0]) !== null && _a !== void 0 ? _a : null;
            }
            catch (error) {
                console.error('Error getting user product:', error);
                throw new Error('Error getting user product');
            }
            finally {
                client.release();
            }
        });
    }
    /**
     * Get schema_version for a user+product from user_products table
     */
    static getSchemaVersion(userEmail_1) {
        return __awaiter(this, arguments, void 0, function* (userEmail, productName = 'MyBalance') {
            var _a;
            const product = yield this.getUserProduct(userEmail, productName);
            return (_a = product === null || product === void 0 ? void 0 : product.schema_version) !== null && _a !== void 0 ? _a : 1;
        });
    }
    /**
     * Update schema_version for a user+product in user_products table
     */
    static updateSchemaVersion(userEmail_1, schemaVersion_1) {
        return __awaiter(this, arguments, void 0, function* (userEmail, schemaVersion, productName = 'MyBalance') {
            const client = yield DbHelper._pool.connect();
            try {
                yield client.query(`UPDATE user_products SET schema_version = $1
         WHERE user_email = $2 AND product_name = $3`, [schemaVersion, userEmail, productName]);
            }
            catch (error) {
                console.error('Error updating schema version:', error);
                throw new Error('Error updating schema version');
            }
            finally {
                client.release();
            }
        });
    }
    /**
     * Upsert user_products row (insert or update spreadsheet_id + schema_version)
     */
    static upsertUserProduct(userEmail_1, spreadsheetId_1, schemaVersion_1) {
        return __awaiter(this, arguments, void 0, function* (userEmail, spreadsheetId, schemaVersion, productName = 'MyBalance') {
            const client = yield DbHelper._pool.connect();
            try {
                yield client.query(`INSERT INTO user_products (user_email, product_name, spreadsheet_id, schema_version)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_email, product_name)
         DO UPDATE SET spreadsheet_id = $3, schema_version = $4`, [userEmail, productName, spreadsheetId, schemaVersion]);
            }
            catch (error) {
                console.error('Error upserting user product:', error);
                throw new Error('Error upserting user product');
            }
            finally {
                client.release();
            }
        });
    }
    /**
     * Set setup_complete flag for a user+product
     */
    static setSetupComplete(userEmail_1) {
        return __awaiter(this, arguments, void 0, function* (userEmail, setupComplete = true, productName = 'MyBalance') {
            const client = yield DbHelper._pool.connect();
            try {
                yield client.query(`UPDATE user_products SET setup_complete = $1
         WHERE user_email = $2 AND product_name = $3`, [setupComplete, userEmail, productName]);
            }
            catch (error) {
                console.error('Error setting setup complete:', error);
                throw new Error('Error setting setup complete');
            }
            finally {
                client.release();
            }
        });
    }
    // === WAITLIST METHODS ===
    /**
     * Add email to waitlist
     */
    static addToWaitlist(email_1) {
        return __awaiter(this, arguments, void 0, function* (email, source = 'landing') {
            const client = yield DbHelper._pool.connect();
            try {
                const { rows } = yield client.query(`INSERT INTO waitlist (email, source)
         VALUES ($1, $2)
         ON CONFLICT (email) DO UPDATE SET source = $2
         RETURNING id, email, created_at`, [email, source]);
                return rows[0];
            }
            catch (error) {
                console.error('Error adding to waitlist:', error);
                throw new Error('Error adding to waitlist');
            }
            finally {
                client.release();
            }
        });
    }
    /**
     * Check if email is already in waitlist
     */
    static isEmailInWaitlist(email) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield DbHelper._pool.connect();
            try {
                const { rows } = yield client.query(`SELECT id FROM waitlist WHERE email = $1`, [email]);
                return rows.length > 0;
            }
            catch (error) {
                console.error('Error checking waitlist:', error);
                throw new Error('Error checking waitlist');
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
    ssl: useSSL ? { rejectUnauthorized: false } : false,
});
//# sourceMappingURL=db.helper.js.map