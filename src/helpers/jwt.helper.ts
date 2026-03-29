import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { JwtPayload, AccessTokenPayload } from '../models';

export class JwtHelper {
  private static readonly ACCESS_TOKEN_TTL = '10m'; // 10 minutes
  private static readonly REFRESH_TOKEN_TTL = '30d'; // 30 days

  // Cache for generated keys (only used if env vars are not set)
  private static _cachedKeys: { privateKey: string; publicKey: string } | null = null;

  /**
   * Generate RSA key pair for JWT signing (in production, these should be pre-generated)
   */
  private static getKeys() {
    // In production, these should come from environment variables or key management service
    const envPrivateKey = process.env.JWT_PRIVATE_KEY;
    const envPublicKey = process.env.JWT_PUBLIC_KEY;

    if (envPrivateKey && envPublicKey) {
      // Parse escaped newlines from .env file
      return {
        privateKey: envPrivateKey.replace(/\\n/g, '\n'),
        publicKey: envPublicKey.replace(/\\n/g, '\n'),
      };
    }

    // Fallback: generate keys once and cache them (for development only)
    if (!this._cachedKeys) {
      console.warn(
        '⚠️ JWT keys not found in environment, generating temporary keys. This is NOT recommended for production!',
      );
      this._cachedKeys = this.generateKeyPair();
    }

    return this._cachedKeys;
  }

  /**
   * Generate RSA key pair (for development only)
   */
  private static generateKeyPair() {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    return { privateKey, publicKey };
  }

  /**
   * Sign JWT access token
   */
  public static signAccessToken(payload: AccessTokenPayload): string {
    const { privateKey } = this.getKeys();

    const tokenPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
      ...payload,
      type: 'access',
    };

    return jwt.sign(tokenPayload, privateKey, {
      algorithm: 'RS256',
      expiresIn: this.ACCESS_TOKEN_TTL,
      issuer: 'mybalance-api',
      audience: 'mybalance-client',
    });
  }

  /**
   * Sign JWT refresh token
   */
  public static signRefreshToken(payload: AccessTokenPayload): string {
    const { privateKey } = this.getKeys();

    const tokenPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
      ...payload,
      type: 'refresh',
    };

    return jwt.sign(tokenPayload, privateKey, {
      algorithm: 'RS256',
      expiresIn: this.REFRESH_TOKEN_TTL,
      issuer: 'mybalance-api',
      audience: 'mybalance-client',
    });
  }

  /**
   * Verify and decode JWT token
   */
  public static verifyAccessToken(token: string): JwtPayload {
    const { publicKey } = this.getKeys();

    try {
      const decoded = jwt.verify(token, publicKey, {
        algorithms: ['RS256'],
        issuer: 'mybalance-api',
        audience: 'mybalance-client',
      }) as JwtPayload;

      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error: any) {
      console.error('JWT verification failed:', error.message);
      throw new Error('Invalid or expired access token');
    }
  }

  /**
   * Verify refresh token
   * Returns null if token is invalid or expired
   */
  public static verifyRefreshToken(token: string): JwtPayload | null {
    const { publicKey } = this.getKeys();

    try {
      const decoded = jwt.verify(token, publicKey, {
        algorithms: ['RS256'],
        issuer: 'mybalance-api',
        audience: 'mybalance-client',
      }) as JwtPayload;

      if (decoded.type !== 'refresh') {
        console.error('JWT verification failed: Invalid token type');
        return null;
      }

      return decoded;
    } catch (error: any) {
      console.error('JWT verification failed:', error.message);
      return null;
    }
  }

  /**
   * Extract token from Authorization header
   */
  public static extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    return authHeader.substring(7); // Remove 'Bearer ' prefix
  }
}
