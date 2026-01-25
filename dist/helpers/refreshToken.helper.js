"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefreshTokenHelper = void 0;
const crypto_1 = __importDefault(require("crypto"));
class RefreshTokenHelper {
    /**
     * Generate a cryptographically secure refresh token
     */
    static generateRefreshToken() {
        const raw = crypto_1.default.randomBytes(this.TOKEN_LENGTH).toString("base64url");
        const hash = this.hashToken(raw);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + this.TTL_DAYS);
        return {
            raw,
            hash,
            expiresAt,
        };
    }
    /**
     * Verify refresh token by comparing hash
     */
    static verifyRefreshToken(raw, hash) {
        try {
            const computedHash = this.hashToken(raw);
            return this.constantTimeEquals(computedHash, hash);
        }
        catch (error) {
            console.error("Error verifying refresh token:", error);
            return false;
        }
    }
    /**
     * Hash token using SHA-256
     */
    static hashToken(token) {
        return crypto_1.default.createHash("sha256").update(token).digest("hex");
    }
    /**
     * Constant-time string comparison to prevent timing attacks
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
    /**
     * Check if refresh token is expired
     */
    static isTokenExpired(expiresAt) {
        return new Date() > expiresAt;
    }
    /**
     * Generate device-specific token salt (optional enhancement)
     */
    static generateDeviceSalt(deviceId) {
        return crypto_1.default
            .createHash("sha256")
            .update(`device:${deviceId}`)
            .digest("hex");
    }
}
exports.RefreshTokenHelper = RefreshTokenHelper;
RefreshTokenHelper.TOKEN_LENGTH = 32; // 32 bytes = 256 bits
RefreshTokenHelper.TTL_DAYS = 30; // 30 days
//# sourceMappingURL=refreshToken.helper.js.map