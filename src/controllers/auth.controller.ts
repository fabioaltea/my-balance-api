import { Request, Response } from "express";
import { GoogleAuthHelper as GoogleOAuthHelper } from "../helpers/google";
import { JwtHelper } from "../helpers/jwt.helper";
import { CryptoHelper } from "../helpers/crypto.helper";
import { DbHelper } from "../helpers/db.helper";
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import {
  GoogleCallbackRequest,
  RefreshRequest,
  PasskeyLoginRequest,
  LogoutRequest,
} from "../models";

export class AuthController {
  /**
   * Handle Google OAuth callback
   * POST /auth/google/callback
   */
  public static async googleCallback(
    req: Request,
    res: Response,
  ): Promise<void> {
    try {
      const { authorizationCode, codeVerifier, deviceId, deviceType } =
        req.body as GoogleCallbackRequest;

      if (!authorizationCode || !deviceId) {
        res.status(400).json({
          success: false,
          error: "Missing required fields",
          required: ["authorizationCode", "deviceId"],
          optional: ["codeVerifier", "deviceType"],
        });
        return;
      }

      const googleOAuthHelper = new GoogleOAuthHelper(deviceType ?? "web");

      // Exchange code for Google tokens
      // Note: codeVerifier is optional - if not provided, PKCE is not used
      const googleTokens = await googleOAuthHelper.exchangeCodeForTokens({
        authorizationCode,
        codeVerifier: codeVerifier || undefined, // Pass undefined if empty string
      });

      // Verify ID token and get user identity
      const identity = await googleOAuthHelper.verifyIdToken(
        googleTokens.idToken,
      );

      // Find or create user in database
      let user = await DbHelper.getUserByEmail(identity.email);
      console.log("User response:", user);
      if (!user) {
        // Create new user
        user = await DbHelper.createUser({
          email: identity.email,
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
        });
      }

      // Update user's last access
      await DbHelper.updateUserLastAccess(user.user_email);

      // Generate JWT tokens
      const tokenPayload = {
        userId: user.user_email, // Using email as userId for consistency
        scopes: googleTokens.scopes,
        deviceType: deviceType || "web", // Include device type in JWT
        deviceId, // Include device ID for session verification
      };

      const accessToken = JwtHelper.signAccessToken(tokenPayload);
      const refreshToken = JwtHelper.signRefreshToken(tokenPayload);

      // Store Google refresh token in user_google_tokens table (UPSERT)
      // One token per user+device_type combination
      if (googleTokens.refreshToken) {
        const encryptedGoogleRefreshToken = CryptoHelper.encrypt(
          googleTokens.refreshToken,
        );
        await DbHelper.storeGoogleRefreshToken(
          user.user_email,
          encryptedGoogleRefreshToken,
          deviceType || "web",
        );
      }

      // Create session for JWT/device tracking (without Google token)
      const sessionId = await DbHelper.createSession({
        userEmail: user.user_email,
        deviceId,
        scopes: googleTokens.scopes,
        deviceType: deviceType || "web",
      });

      res.json({
        success: true,
        accessToken,
        refreshToken, // JWT refresh token
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
      console.log("🔄 Token refresh request received");
      const { refreshToken, deviceId } = req.body as RefreshRequest;
      console.log("🔄 Device ID:", deviceId);
      console.log(
        "🔄 Refresh token (first 50 chars):",
        refreshToken?.substring(0, 50),
      );

      if (!refreshToken || !deviceId) {
        console.log("❌ Missing refresh token or device ID");
        res.status(400).json({
          success: false,
          error: "Missing refresh token or device ID",
        });
        return;
      }

      // Verify JWT refresh token
      console.log("🔄 Verifying JWT refresh token...");
      const decoded = JwtHelper.verifyRefreshToken(refreshToken);
      if (!decoded) {
        console.log("❌ JWT verification failed - token invalid or expired");
        res.status(401).json({
          success: false,
          error: "Invalid or expired refresh token",
          code: "INVALID_REFRESH_TOKEN",
        });
        return;
      }
      console.log("✅ JWT verified, userId:", decoded.userId);

      // Check if session exists (for revocation support)
      console.log("🔄 Looking up session for device:", deviceId);
      const session = await DbHelper.getSessionByDeviceId(deviceId);
      if (!session) {
        console.log("❌ Session not found or expired for device:", deviceId);
        res.status(401).json({
          success: false,
          error: "Session not found or revoked",
          code: "SESSION_REVOKED",
        });
        return;
      }
      console.log("✅ Session found for user:", session.user_email);

      // Verify the token belongs to the session user
      if (decoded.userId !== session.user_email) {
        res.status(401).json({
          success: false,
          error: "Token does not match session",
          code: "TOKEN_MISMATCH",
        });
        return;
      }

      // Get user info
      const user = await DbHelper.getUserByEmail(session.user_email);
      if (!user) {
        res.status(404).json({
          success: false,
          error: "User not found",
        });
        return;
      }

      // Generate new access token (keep same refresh token - JWT is self-validating)
      const tokenPayload = {
        userId: user.user_email,
        scopes: decoded.scopes || session.scopes || [],
        deviceType: decoded.deviceType || (session as any).device_type || "web",
        deviceId, // Include device ID for session verification
      };

      const accessToken = JwtHelper.signAccessToken(tokenPayload);

      res.json({
        success: true,
        accessToken,
        refreshToken, // Return same refresh token (JWT doesn't need rotation)
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

      let user = await DbHelper.getUserByEmail(userEmail);
      if (!user) {
        res.status(404).json({
          success: false,
          error: "User not found",
        });
        return;
      }

      // If user doesn't have a spreadsheet ID, they'll need to create one
      // For now, we return the profile without spreadsheetId and let the frontend handle it
      if (!user.spreadsheet_id) {
        console.log(
          `⚠️ User ${userEmail} has no spreadsheet configured - will use quickstart mode`,
        );
      }

      res.json({
        success: true,
        user: {
          id: user.user_email,
          email: user.user_email,
          name: user.user_name,
          picture: user.user_picture,
          emailVerified: user.email_verified,
          spreadsheetId: user.spreadsheet_id || null, // Can be null for new users
          lastAccess: user.last_access,
          pushNotificationsEnabled: !!user.push_token,
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

  /**
   * Save push notification token
   * POST /auth/push-token
   */
  public static async savePushToken(req: any, res: Response): Promise<void> {
    try {
      const userEmail = req.userId;
      const { pushToken } = req.body;

      if (!pushToken) {
        res.status(400).json({
          success: false,
          error: "Missing push token",
        });
        return;
      }

      await DbHelper.savePushToken(userEmail, pushToken);

      res.json({
        success: true,
        message: "Push token saved successfully",
      });
    } catch (error: any) {
      console.error("Save push token error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to save push token",
        details: error.message,
      });
    }
  }

  /**
   * Remove push notification token
   * DELETE /auth/push-token
   */
  public static async removePushToken(req: any, res: Response): Promise<void> {
    try {
      const userEmail = req.userId;

      await DbHelper.removePushToken(userEmail);

      res.json({
        success: true,
        message: "Push token removed successfully",
      });
    } catch (error: any) {
      console.error("Remove push token error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to remove push token",
        details: error.message,
      });
    }
  }
}
