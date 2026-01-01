import { Request, Response } from "express";
import { GoogleOAuthHelper } from "../helpers/googleOAuth.helper";
import { JwtHelper } from "../helpers/jwt.helper";
import { RefreshTokenHelper } from "../helpers/refreshToken.helper";
import { CryptoHelper } from "../helpers/crypto.helper";
import { DbHelper } from "../../helpers/DbHelper";
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";

export interface GoogleCallbackRequest {
  authorizationCode: string;
  codeVerifier?: string; // Optional for PKCE support
  deviceId: string;
}

export interface RefreshRequest {
  refreshToken: string;
  deviceId: string;
}

export interface PasskeyLoginRequest {
  passkeyAssertion: any; // WebAuthn assertion response
  deviceId: string;
}

export interface LogoutRequest {
  refreshToken?: string;
  deviceId: string;
}

export class AuthController {
  /**
   * Handle Google OAuth callback
   * POST /auth/google/callback
   */
  public static async googleCallback(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { authorizationCode, codeVerifier, deviceId } =
        req.body as GoogleCallbackRequest;

      if (!authorizationCode || !deviceId) {
        res.status(400).json({
          success: false,
          error: "Missing required fields",
          required: ["authorizationCode", "deviceId"],
          optional: ["codeVerifier"],
        });
        return;
      }

      // Exchange code for Google tokens
      // Note: codeVerifier is optional - if not provided, PKCE is not used
      const googleTokens = await GoogleOAuthHelper.exchangeCodeForTokens({
        authorizationCode,
        codeVerifier: codeVerifier || undefined, // Pass undefined if empty string
        clientId: process.env.CLIENT_ID!,
        clientSecret: process.env.CLIENT_SECRET!,
        redirectUri: process.env.REDIRECT_URI!,
      });

      // Verify ID token and get user identity
      const identity = await GoogleOAuthHelper.verifyIdToken(
        googleTokens.idToken
      );

      // Find or create user in database
      let user = await DbHelper.getUserByEmail(identity.email);
      console.log("User response:", user);
      if (!user) {
        // Create new user
        user = await DbHelper.createUser({
          email: identity.email,
          googleSub: identity.googleSub,
          name: identity.name || "",
          picture: identity.picture || "",
          emailVerified: identity.emailVerified,
        });
      } else {
        // Update existing user with latest info
        await DbHelper.updateUser(user.user_email, {
          name: identity.name || user.user_name,
          picture: identity.picture || user.user_picture,
          emailVerified: identity.emailVerified,
          googleSub: identity.googleSub,
        });
      }

      // Store encrypted Google refresh token if provided
      if (googleTokens.refreshToken) {
        const encryptedRefreshToken = CryptoHelper.encrypt(
          googleTokens.refreshToken
        );
        await DbHelper.storeGoogleRefreshToken(
          user.user_email,
          encryptedRefreshToken
        );
      }

      // Update user's last access
      await DbHelper.updateUserLastAccess(user.user_email);

      // Generate internal refresh token
      const internalRefreshToken = RefreshTokenHelper.generateRefreshToken();

      // Create session
      const sessionId = await DbHelper.createSession({
        userEmail: user.user_email,
        deviceId,
        refreshTokenHash: internalRefreshToken.hash,
        expiresAt: internalRefreshToken.expiresAt,
        scopes: googleTokens.scopes,
      });

      // Generate JWT tokens
      const tokenPayload = {
        userId: user.user_email, // Using email as userId for consistency
        scopes: googleTokens.scopes,
      };

      const accessToken = JwtHelper.signAccessToken(tokenPayload);
      const refreshToken = JwtHelper.signRefreshToken(tokenPayload);

      res.json({
        success: true,
        accessToken,
        refreshToken, // Use JWT refresh token instead of Google internal token
        user: {
          id: user.id,
          email: user.user_email,
          name: user.user_name,
          picture: user.user_picture,
        },
      });
    } catch (error: any) {
      console.error("Google callback error:", error);
      res.status(500).json({
        success: false,
        error: "Authentication failed",
        details: error.message,
      });
    }
  }

  /**
   * Refresh access token
   * POST /auth/refresh
   */
  public static async refresh(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken, deviceId } = req.body as RefreshRequest;

      if (!refreshToken || !deviceId) {
        res.status(400).json({
          success: false,
          error: "Missing refresh token or device ID",
        });
        return;
      }

      // Get session from database
      const session = await DbHelper.getSessionByDeviceId(deviceId);

      if (!session || RefreshTokenHelper.isTokenExpired(session.expires_at)) {
        res.status(401).json({
          success: false,
          error: "Invalid or expired session",
          code: "SESSION_EXPIRED",
        });
        return;
      }

      // Verify refresh token hash
      if (
        !RefreshTokenHelper.verifyRefreshToken(
          refreshToken,
          session.refresh_token_hash
        )
      ) {
        res.status(401).json({
          success: false,
          error: "Invalid refresh token",
          code: "INVALID_REFRESH_TOKEN",
        });
        return;
      }

      // Generate new refresh token (rotation)
      const newRefreshToken = RefreshTokenHelper.generateRefreshToken();

      // Update session with new refresh token
      await DbHelper.updateSession(session.id, {
        refreshTokenHash: newRefreshToken.hash,
        expiresAt: newRefreshToken.expiresAt,
      });

      // Get user info
      const user = await DbHelper.getUserByEmail(session.user_email);
      if (!user) {
        res.status(404).json({
          success: false,
          error: "User not found",
        });
        return;
      }

      // Generate new access token
      const tokenPayload = {
        userId: user.user_email, // Using email as userId for consistency
        scopes: session.scopes || [],
      };

      const accessToken = JwtHelper.signAccessToken(tokenPayload);

      res.json({
        success: true,
        accessToken,
        refreshToken: newRefreshToken.raw,
      });
    } catch (error: any) {
      console.error("Token refresh error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to refresh token",
        details: error.message,
      });
    }
  }

  /**
   * Passkey authentication - TODO: Fix WebAuthn types
   * POST /auth/passkey/login
   */
  public static async passkeyLogin(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement WebAuthn passkey login after fixing type issues
      res.status(501).json({
        success: false,
        error: "Passkey authentication not yet implemented",
        message: "Use Google OAuth for authentication",
      });
    } catch (error: any) {
      console.error("Passkey login error:", error);
      res.status(500).json({
        success: false,
        error: "Passkey authentication failed",
        details: error.message,
      });
    }
  }

  /**
   * Logout - revoke current session
   * POST /auth/logout
   */
  public static async logout(req: Request, res: Response): Promise<void> {
    try {
      const { deviceId, refreshToken } = req.body as LogoutRequest;

      if (!deviceId) {
        res.status(400).json({
          success: false,
          error: "Missing device ID",
        });
        return;
      }

      // Revoke session
      await DbHelper.revokeSession(deviceId);

      res.json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error: any) {
      console.error("Logout error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to logout",
        details: error.message,
      });
    }
  }

  /**
   * Get user profile (requires authentication)
   * GET /auth/profile
   */
  public static async getProfile(req: any, res: Response): Promise<void> {
    try {
      const userEmail = req.userId; // Set by auth middleware (now contains email)

      const user = await DbHelper.getUserByEmail(userEmail);
      if (!user) {
        res.status(404).json({
          success: false,
          error: "User not found",
        });
        return;
      }

      res.json({
        success: true,
        user: {
          id: user.user_email,
          email: user.user_email,
          name: user.user_name,
          picture: user.user_picture,
          emailVerified: user.email_verified,
          spreadsheetId: user.spreadsheet_id,
          lastAccess: user.last_access,
        },
      });
    } catch (error: any) {
      console.error("Get profile error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get profile",
        details: error.message,
      });
    }
  }
}
