"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CryptoHelper = void 0;
const crypto_1 = __importDefault(require("crypto"));
const crypto_js_1 = __importDefault(require("crypto-js"));
class CryptoHelper {
    /**
     * Get encryption key from environment
     */
    static getKey() {
        const key = process.env.ENCRYPTION_KEY;
        if (!key) {
            throw new Error("ENCRYPTION_KEY environment variable is required");
        }
        if (key.length !== 64) {
            // 32 bytes = 64 hex characters
            throw new Error("ENCRYPTION_KEY must be 32 bytes (64 hex characters)");
        }
        return key;
    }
    /**
     * Encrypt sensitive data using AES-256-GCM
     */
    static encrypt(text) {
        try {
            const key = Buffer.from(this.getKey(), "hex");
            const iv = crypto_1.default.randomBytes(this.IV_LENGTH);
            const cipher = crypto_1.default.createCipheriv(this.ALGORITHM, key, iv);
            cipher.setAAD(Buffer.from("mybalance-auth", "utf8"));
            let encrypted = cipher.update(text, "utf8", "hex");
            encrypted += cipher.final("hex");
            const tag = cipher.getAuthTag();
            // Combine IV, tag, and encrypted data
            const result = iv.toString("hex") + tag.toString("hex") + encrypted;
            return result;
        }
        catch (error) {
            console.error("Encryption failed:", error);
            throw new Error("Failed to encrypt data");
        }
    }
    /**
     * Decrypt sensitive data using AES-256-GCM
     */
    static decrypt(encryptedData) {
        try {
            const key = Buffer.from(this.getKey(), "hex");
            // Extract IV, tag, and encrypted data
            const iv = Buffer.from(encryptedData.substring(0, this.IV_LENGTH * 2), "hex");
            const tag = Buffer.from(encryptedData.substring(this.IV_LENGTH * 2, (this.IV_LENGTH + this.TAG_LENGTH) * 2), "hex");
            const encrypted = encryptedData.substring((this.IV_LENGTH + this.TAG_LENGTH) * 2);
            const decipher = crypto_1.default.createDecipheriv(this.ALGORITHM, key, iv);
            decipher.setAAD(Buffer.from("mybalance-auth", "utf8"));
            decipher.setAuthTag(tag);
            let decrypted = decipher.update(encrypted, "hex", "utf8");
            decrypted += decipher.final("utf8");
            return decrypted;
        }
        catch (error) {
            console.error("Decryption failed:", error);
            throw new Error("Failed to decrypt data");
        }
    }
    /**
     * Alternative encryption using CryptoJS (for backward compatibility)
     */
    static encryptLegacy(text) {
        const key = this.getKey();
        return crypto_js_1.default.AES.encrypt(text, key).toString();
    }
    /**
     * Alternative decryption using CryptoJS (for backward compatibility)
     */
    static decryptLegacy(encryptedText) {
        const key = this.getKey();
        const bytes = crypto_js_1.default.AES.decrypt(encryptedText, key);
        return bytes.toString(crypto_js_1.default.enc.Utf8);
    }
    /**
     * Generate a random encryption key (for setup/migration)
     */
    static generateKey() {
        return crypto_1.default.randomBytes(32).toString("hex");
    }
    /**
     * Hash password or sensitive data using PBKDF2
     */
    static hashPassword(password, salt) {
        const actualSalt = salt || crypto_1.default.randomBytes(32).toString("hex");
        const hash = crypto_1.default
            .pbkdf2Sync(password, actualSalt, 10000, 64, "sha512")
            .toString("hex");
        return {
            hash,
            salt: actualSalt,
        };
    }
    /**
     * Verify password against hash
     */
    static verifyPassword(password, hash, salt) {
        const computedHash = crypto_1.default
            .pbkdf2Sync(password, salt, 10000, 64, "sha512")
            .toString("hex");
        return this.constantTimeEquals(hash, computedHash);
    }
    /**
     * Constant-time string comparison
     */
    static constantTimeEquals(a, b) {
        if (a.length !== b.length) {
            return false;
        }
        let result = 0;
        for (let i = 0; i < a.length; i++) {
            result |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }
        return result === 0;
    }
}
exports.CryptoHelper = CryptoHelper;
CryptoHelper.ALGORITHM = "aes-256-gcm";
CryptoHelper.IV_LENGTH = 16; // 128 bits
CryptoHelper.TAG_LENGTH = 16; // 128 bits
//# sourceMappingURL=crypto.helper.js.map