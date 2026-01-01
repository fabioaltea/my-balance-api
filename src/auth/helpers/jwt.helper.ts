import jwt, { JwtPayload as BaseJwtPayload } from "jsonwebtoken";
import crypto from "crypto";

export interface JwtPayload extends BaseJwtPayload {
  userId: string;
  scopes: string[];
  type: "access" | "refresh";
}

export interface AccessTokenPayload {
  userId: string;
  scopes: string[];
}

export class JwtHelper {
  private static readonly ACCESS_TOKEN_TTL = "10m"; // 10 minutes
  private static readonly REFRESH_TOKEN_TTL = "30d"; // 30 days

  /**
   * Generate RSA key pair for JWT signing (in production, these should be pre-generated)
   */
  private static getKeys() {
    // In production, these should come from environment variables or key management service
    const privateKey =
      process.env.JWT_PRIVATE_KEY || this.generateKeyPair().privateKey;
    const publicKey =
      process.env.JWT_PUBLIC_KEY || this.generateKeyPair().publicKey;

    return { privateKey, publicKey };
  }

  /**
   * Generate RSA key pair (for development only)
   */
  private static generateKeyPair() {
    const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
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
  public static signAccessToken(payload: AccessTokenPayload): string {
    const { privateKey } = this.getKeys();

    const tokenPayload: Omit<JwtPayload, "iat" | "exp"> = {
      ...payload,
      type: "access",
    };

    return jwt.sign(tokenPayload, privateKey, {
      algorithm: "RS256",
      expiresIn: this.ACCESS_TOKEN_TTL,
      issuer: "mybalance-api",
      audience: "mybalance-client",
    });
  }

  /**
   * Sign JWT refresh token
   */
  public static signRefreshToken(payload: AccessTokenPayload): string {
    const { privateKey } = this.getKeys();

    const tokenPayload: Omit<JwtPayload, "iat" | "exp"> = {
      ...payload,
      type: "refresh",
    };

    return jwt.sign(tokenPayload, privateKey, {
      algorithm: "RS256",
      expiresIn: this.REFRESH_TOKEN_TTL,
      issuer: "mybalance-api",
      audience: "mybalance-client",
    });
  }

  /**
   * Verify and decode JWT token
   */
  public static verifyAccessToken(token: string): JwtPayload {
    const { publicKey } = this.getKeys();

    try {
      const decoded = jwt.verify(token, publicKey, {
        algorithms: ["RS256"],
        issuer: "mybalance-api",
        audience: "mybalance-client",
      }) as JwtPayload;

      if (decoded.type !== "access") {
        throw new Error("Invalid token type");
      }

      return decoded;
    } catch (error: any) {
      console.error("JWT verification failed:", error.message);
      throw new Error("Invalid or expired access token");
    }
  }

  /**
   * Verify refresh token
   */
  public static verifyRefreshToken(token: string): JwtPayload {
    const { publicKey } = this.getKeys();

    try {
      const decoded = jwt.verify(token, publicKey, {
        algorithms: ["RS256"],
        issuer: "mybalance-api",
        audience: "mybalance-client",
      }) as JwtPayload;

      if (decoded.type !== "refresh") {
        throw new Error("Invalid token type");
      }

      return decoded;
    } catch (error: any) {
      console.error("JWT verification failed:", error.message);
      throw new Error("Invalid or expired refresh token");
    }
  }

  /**
   * Extract token from Authorization header
   */
  public static extractTokenFromHeader(
    authHeader: string | undefined
  ): string | null {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }

    return authHeader.substring(7); // Remove 'Bearer ' prefix
  }
}
