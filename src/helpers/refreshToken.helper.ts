import crypto from "crypto";

export interface RefreshTokenData {
  raw: string;
  hash: string;
  expiresAt: Date;
}

export class RefreshTokenHelper {
  private static readonly TOKEN_LENGTH = 32; // 32 bytes = 256 bits
  private static readonly TTL_DAYS = 30; // 30 days

  /**
   * Generate a cryptographically secure refresh token
   */
  public static generateRefreshToken(): RefreshTokenData {
    const raw = crypto.randomBytes(this.TOKEN_LENGTH).toString("base64url");
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
  public static verifyRefreshToken(raw: string, hash: string): boolean {
    try {
      const computedHash = this.hashToken(raw);
      return this.constantTimeEquals(computedHash, hash);
    } catch (error) {
      console.error("Error verifying refresh token:", error);
      return false;
    }
  }

  /**
   * Hash token using SHA-256
   */
  private static hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  private static constantTimeEquals(a: string, b: string): boolean {
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
  public static isTokenExpired(expiresAt: Date): boolean {
    return new Date() > expiresAt;
  }

  /**
   * Generate device-specific token salt (optional enhancement)
   */
  public static generateDeviceSalt(deviceId: string): string {
    return crypto
      .createHash("sha256")
      .update(`device:${deviceId}`)
      .digest("hex");
  }
}
