import crypto from "crypto";
import CryptoJS from "crypto-js";

export class CryptoHelper {
  private static readonly ALGORITHM = "aes-256-gcm";
  private static readonly IV_LENGTH = 16; // 128 bits
  private static readonly TAG_LENGTH = 16; // 128 bits

  /**
   * Get encryption key from environment
   */
  private static getKey(): string {
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
  public static encrypt(text: string): string {
    try {
      const key = Buffer.from(this.getKey(), "hex");
      const iv = crypto.randomBytes(this.IV_LENGTH);

      const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);
      cipher.setAAD(Buffer.from("mybalance-auth", "utf8"));

      let encrypted = cipher.update(text, "utf8", "hex");
      encrypted += cipher.final("hex");

      const tag = cipher.getAuthTag();

      // Combine IV, tag, and encrypted data
      const result = iv.toString("hex") + tag.toString("hex") + encrypted;
      return result;
    } catch (error: any) {
      console.error("Encryption failed:", error);
      throw new Error("Failed to encrypt data");
    }
  }

  /**
   * Decrypt sensitive data using AES-256-GCM
   */
  public static decrypt(encryptedData: string): string {
    try {
      const key = Buffer.from(this.getKey(), "hex");

      // Extract IV, tag, and encrypted data
      const iv = Buffer.from(
        encryptedData.substring(0, this.IV_LENGTH * 2),
        "hex"
      );
      const tag = Buffer.from(
        encryptedData.substring(
          this.IV_LENGTH * 2,
          (this.IV_LENGTH + this.TAG_LENGTH) * 2
        ),
        "hex"
      );
      const encrypted = encryptedData.substring(
        (this.IV_LENGTH + this.TAG_LENGTH) * 2
      );

      const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
      decipher.setAAD(Buffer.from("mybalance-auth", "utf8"));
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error: any) {
      console.error("Decryption failed:", error);
      throw new Error("Failed to decrypt data");
    }
  }

  /**
   * Alternative encryption using CryptoJS (for backward compatibility)
   */
  public static encryptLegacy(text: string): string {
    const key = this.getKey();
    return CryptoJS.AES.encrypt(text, key).toString();
  }

  /**
   * Alternative decryption using CryptoJS (for backward compatibility)
   */
  public static decryptLegacy(encryptedText: string): string {
    const key = this.getKey();
    const bytes = CryptoJS.AES.decrypt(encryptedText, key);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  /**
   * Generate a random encryption key (for setup/migration)
   */
  public static generateKey(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Hash password or sensitive data using PBKDF2
   */
  public static hashPassword(
    password: string,
    salt?: string
  ): { hash: string; salt: string } {
    const actualSalt = salt || crypto.randomBytes(32).toString("hex");
    const hash = crypto
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
  public static verifyPassword(
    password: string,
    hash: string,
    salt: string
  ): boolean {
    const computedHash = crypto
      .pbkdf2Sync(password, salt, 10000, 64, "sha512")
      .toString("hex");
    return this.constantTimeEquals(hash, computedHash);
  }

  /**
   * Constant-time string comparison
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
}
