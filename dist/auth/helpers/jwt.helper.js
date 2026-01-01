"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JwtHelper = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
class JwtHelper {
    /**
     * Generate RSA key pair for JWT signing (in production, these should be pre-generated)
     */
    static getKeys() {
        // In production, these should come from environment variables or key management service
        const privateKey = process.env.JWT_PRIVATE_KEY || this.generateKeyPair().privateKey;
        const publicKey = process.env.JWT_PUBLIC_KEY || this.generateKeyPair().publicKey;
        return { privateKey, publicKey };
    }
    /**
     * Generate RSA key pair (for development only)
     */
    static generateKeyPair() {
        const { privateKey, publicKey } = crypto_1.default.generateKeyPairSync("rsa", {
            modulusLength: 2048,
            publicKeyEncoding: {
                type: "spki",
                format: "pem",
            },
            privateKeyEncoding: {
                type: "pkcs8",
                format: "pem",
            },
        });
        return { privateKey, publicKey };
    }
    /**
     * Sign JWT access token
     */
    static signAccessToken(payload) {
        const { privateKey } = this.getKeys();
        const tokenPayload = Object.assign(Object.assign({}, payload), { type: "access" });
        return jsonwebtoken_1.default.sign(tokenPayload, privateKey, {
            algorithm: "RS256",
            expiresIn: this.ACCESS_TOKEN_TTL,
            issuer: "mybalance-api",
            audience: "mybalance-client",
        });
    }
    /**
     * Sign JWT refresh token
     */
    static signRefreshToken(payload) {
        const { privateKey } = this.getKeys();
        const tokenPayload = Object.assign(Object.assign({}, payload), { type: "refresh" });
        return jsonwebtoken_1.default.sign(tokenPayload, privateKey, {
            algorithm: "RS256",
            expiresIn: this.REFRESH_TOKEN_TTL,
            issuer: "mybalance-api",
            audience: "mybalance-client",
        });
    }
    /**
     * Verify and decode JWT token
     */
    static verifyAccessToken(token) {
        const { publicKey } = this.getKeys();
        try {
            const decoded = jsonwebtoken_1.default.verify(token, publicKey, {
                algorithms: ["RS256"],
                issuer: "mybalance-api",
                audience: "mybalance-client",
            });
            if (decoded.type !== "access") {
                throw new Error("Invalid token type");
            }
            return decoded;
        }
        catch (error) {
            console.error("JWT verification failed:", error.message);
            throw new Error("Invalid or expired access token");
        }
    }
    /**
     * Verify refresh token
     */
    static verifyRefreshToken(token) {
        const { publicKey } = this.getKeys();
        try {
            const decoded = jsonwebtoken_1.default.verify(token, publicKey, {
                algorithms: ["RS256"],
                issuer: "mybalance-api",
                audience: "mybalance-client",
            });
            if (decoded.type !== "refresh") {
                throw new Error("Invalid token type");
            }
            return decoded;
        }
        catch (error) {
            console.error("JWT verification failed:", error.message);
            throw new Error("Invalid or expired refresh token");
        }
    }
    /**
     * Extract token from Authorization header
     */
    static extractTokenFromHeader(authHeader) {
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return null;
        }
        return authHeader.substring(7); // Remove 'Bearer ' prefix
    }
}
exports.JwtHelper = JwtHelper;
JwtHelper.ACCESS_TOKEN_TTL = "10m"; // 10 minutes
JwtHelper.REFRESH_TOKEN_TTL = "30d"; // 30 days
//# sourceMappingURL=jwt.helper.js.map