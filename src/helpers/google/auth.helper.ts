import {
  OAuth2Client,
  OAuth2ClientOptions,
  TokenPayload,
} from "google-auth-library";
import { CryptoHelper } from "../crypto.helper";
import { DbHelper } from "../db.helper";
import {
  GoogleTokens,
  GoogleIdentity,
  ExchangeCodeParams,
  DeviceType,
} from "../../models";

// Custom error for Google token issues that require re-authentication
export class GoogleTokenError extends Error {
  public readonly code: string;

  constructor(message: string, code: string = "GOOGLE_TOKEN_INVALID") {
    super(message);
    this.name = "GoogleTokenError";
    this.code = code;
  }
}

// Result of refreshing access token - may include new refresh token
export interface RefreshResult {
  accessToken: string;
  newRefreshToken?: string;
}

// ============================================================================
// GOOGLE AUTH HELPER - Unified helper for all Google OAuth operations
// ============================================================================

export class GoogleAuthHelper {
  private client: OAuth2Client;
  private deviceType: DeviceType;

  // ============================================================================
  // CONSTRUCTOR & CLIENT INITIALIZATION
  // ============================================================================

  constructor(deviceType: DeviceType = "web") {
    this.deviceType = deviceType;
    this.initializeClient(deviceType);
  }

  private initializeClient(deviceType: DeviceType): void {
    switch (deviceType) {
      case "ios":
        this.loadIOSClient();
        break;
      case "android":
        this.loadAndroidClient();
        break;
      case "web":
      default:
        this.loadWebClient();
        break;
    }
  }

  private loadWebClient(): void {
    console.log("Loading web OAuth2 client with params:", {
      clientId: process.env.CLIENT_ID_WEB,
      clientSecret: process.env.CLIENT_SECRET ? "***" : undefined,
      redirectUri: process.env.REDIRECT_URI_WEB,
    });
    this.client = new OAuth2Client(
      process.env.CLIENT_ID_WEB,
      process.env.CLIENT_SECRET,
      process.env.REDIRECT_URI_WEB,
    );
  }

  private loadIOSClient(): void {
    // iOS is a "public client" - no client secret
    this.client = new OAuth2Client({
      clientId: process.env.CLIENT_ID_IOS,
      redirectUri: process.env.REDIRECT_URI_IOS,
    } as OAuth2ClientOptions);
  }

  private loadAndroidClient(): void {
    console.log("Loading Android OAuth2 client with params:", {
      clientId: process.env.CLIENT_ID_ANDROID,
      redirectUri:
        process.env.REDIRECT_URI_ANDROID || process.env.REDIRECT_URI_IOS,
    });
    // Android is a "public client" - no client secret
    this.client = new OAuth2Client({
      clientId: process.env.CLIENT_ID_ANDROID || process.env.CLIENT_ID_IOS,
      redirectUri:
        process.env.REDIRECT_URI_ANDROID || process.env.REDIRECT_URI_IOS,
    } as OAuth2ClientOptions);
  }

  // ============================================================================
  // PUBLIC GETTERS
  // ============================================================================

  /**
   * Get the underlying OAuth2 client
   */
  public getClient(): OAuth2Client {
    return this.client;
  }

  /**
   * Get the device type this helper was initialized with
   */
  public getDeviceType(): DeviceType {
    return this.deviceType;
  }

  // ============================================================================
  // TOKEN EXCHANGE & VERIFICATION (for login flow)
  // ============================================================================

  /**
   * Exchange authorization code for Google tokens
   */
  public async exchangeCodeForTokens(
    params: ExchangeCodeParams,
  ): Promise<GoogleTokens> {
    try {
      // Prepare token request - only include codeVerifier if provided (for PKCE)
      const tokenRequest: any = {
        code: params.authorizationCode,
      };

      // Only add codeVerifier if it's provided and not empty
      if (params.codeVerifier && params.codeVerifier.trim()) {
        tokenRequest.codeVerifier = params.codeVerifier;
        console.log("Using PKCE code verifier for token exchange");
      }

      // If redirectUri is provided, use it (needed for web where the URI is dynamic)
      if (params.redirectUri) {
        tokenRequest.redirect_uri = params.redirectUri;
        console.log("Using custom redirect URI for token exchange:", params.redirectUri);
      }

      const { tokens } = await this.client.getToken(tokenRequest);

      if (!tokens.id_token) {
        throw new Error("No ID token received from Google");
      }

      return {
        idToken: tokens.id_token,
        refreshToken: tokens.refresh_token || undefined,
        scopes: tokens.scope?.split(" ") || [],
      };
    } catch (error: any) {
      console.error(
        "Error exchanging authorization code:",
        error.response?.data?.error_description || error.message,
      );
      throw new Error(
        `Failed to exchange authorization code: ${error.message}`,
      );
    }
  }

  /**
   * Verify Google ID token and extract identity information
   */
  public async verifyIdToken(idToken: string): Promise<GoogleIdentity> {
    console.log("Verifying ID token for client", this.client._clientId);
    try {
      const ticket = await this.client.verifyIdToken({
        idToken: idToken,
        audience: this.client._clientId,
      });

      const payload: TokenPayload | undefined = ticket.getPayload();

      if (!payload) {
        throw new Error("Invalid ID token payload");
      }

      // Verify issuer
      if (
        payload.iss !== "https://accounts.google.com" &&
        payload.iss !== "accounts.google.com"
      ) {
        throw new Error("Invalid token issuer");
      }

      // Verify audience
      if (payload.aud !== this.client._clientId) {
        throw new Error("Invalid token audience");
      }

      if (!payload.email) {
        throw new Error("Missing required fields in ID token");
      }

      return {
        email: payload.email,
        emailVerified: payload.email_verified || false,
        name: payload.name,
        picture: payload.picture,
      };
    } catch (error: any) {
      console.error("Error verifying ID token:", error);
      throw new Error(`Failed to verify ID token: ${error.message}`);
    }
  }

  // ============================================================================
  // AUTHENTICATED CLIENT (for API calls like Sheets)
  // ============================================================================

  /**
   * Set credentials on the client (refresh token) for making authenticated API calls
   */
  public setCredentials(refreshToken: string): void {
    this.client.setCredentials({
      refresh_token: refreshToken,
    });
  }

  /**
   * Refresh the access token if needed
   * Also returns new refresh token if Google rotates it
   */
  public async refreshAccessToken(): Promise<RefreshResult> {
    try {
      // getAccessToken() internally refreshes if needed
      const { token, res } = await this.client.getAccessToken();

      if (!token) {
        throw new GoogleTokenError(
          "Failed to obtain access token - refresh token may be invalid",
          "GOOGLE_TOKEN_REFRESH_FAILED",
        );
      }

      // Check if Google returned a new refresh token (token rotation)
      const credentials = this.client.credentials;
      const newRefreshToken = credentials.refresh_token;

      // Log if we got a rotated token
      if (newRefreshToken && res?.data?.refresh_token) {
        console.log("🔄 Google returned a new refresh token (token rotation)");
      }

      return {
        accessToken: token,
        newRefreshToken: res?.data?.refresh_token || undefined,
      };
    } catch (error: any) {
      console.error("Error refreshing access token:", error);

      // Check for specific Google errors that indicate token is invalid
      const errorMessage = error.message?.toLowerCase() || "";
      const isTokenInvalid =
        errorMessage.includes("invalid_grant") ||
        errorMessage.includes("token has been expired or revoked") ||
        errorMessage.includes("token has been revoked") ||
        errorMessage.includes("invalid credentials") ||
        error.code === 401;

      if (isTokenInvalid) {
        throw new GoogleTokenError(
          "Google refresh token is invalid or revoked. User must re-authenticate.",
          "GOOGLE_TOKEN_REVOKED",
        );
      }

      throw new GoogleTokenError(
        `Failed to refresh access token: ${error.message}`,
        "GOOGLE_TOKEN_REFRESH_FAILED",
      );
    }
  }

  // ============================================================================
  // STATIC METHODS - Database operations & authenticated client factory
  // ============================================================================

  /**
   * Get an authenticated OAuth2 client for a user (with refresh token from DB)
   * This is the main method for making API calls (Sheets, etc.)
   * Handles token rotation by saving new refresh tokens to DB
   */
  public static async getAuthClientForUser(
    userEmail: string,
    deviceType: DeviceType = "web",
  ): Promise<OAuth2Client> {
    try {
      // Get encrypted refresh token from user_google_tokens table
      const encryptedToken = await DbHelper.getGoogleRefreshToken(
        userEmail,
        deviceType,
      );

      if (!encryptedToken) {
        throw new GoogleTokenError(
          `No Google refresh token found for user ${userEmail} with device type ${deviceType}. User must re-authenticate.`,
          "GOOGLE_TOKEN_NOT_FOUND",
        );
      }

      // Decrypt the refresh token
      const refreshToken = CryptoHelper.decrypt(encryptedToken);

      // Create helper with the correct device type
      const helper = new GoogleAuthHelper(deviceType);

      // Set the refresh token credentials
      helper.setCredentials(refreshToken);

      // Refresh access token to ensure it's valid
      const refreshResult = await helper.refreshAccessToken();

      // If Google returned a new refresh token (token rotation), save it
      if (refreshResult.newRefreshToken) {
        console.log(
          `💾 Saving rotated Google refresh token for user: ${userEmail}, deviceType: ${deviceType}`,
        );
        const encryptedNewToken = CryptoHelper.encrypt(
          refreshResult.newRefreshToken,
        );
        await DbHelper.storeGoogleRefreshToken(
          userEmail,
          encryptedNewToken,
          deviceType,
        );
        console.log("✅ Rotated Google refresh token saved successfully");

        // Update client credentials with new refresh token
        helper.setCredentials(refreshResult.newRefreshToken);
      }

      return helper.getClient();
    } catch (error: any) {
      console.error("Error getting auth client for user:", error);

      // Re-throw GoogleTokenError as-is for proper handling upstream
      if (error instanceof GoogleTokenError) {
        throw error;
      }

      // Wrap other errors
      throw new GoogleTokenError(
        `Failed to get Google auth client: ${error.message}`,
        "GOOGLE_AUTH_FAILED",
      );
    }
  }

  /**
   * Get user's spreadsheet ID from database
   */
  public static async getSpreadsheetIdForUser(
    userEmail: string,
  ): Promise<string | null> {
    try {
      const user = await DbHelper.getUserByEmail(userEmail);
      return user?.spreadsheet_id || null;
    } catch (error: any) {
      console.error("Error getting spreadsheet ID for user:", error);
      return null;
    }
  }

  /**
   * Set spreadsheet ID for user
   */
  public static async setSpreadsheetIdForUser(
    userEmail: string,
    spreadsheetId: string,
  ): Promise<void> {
    try {
      const user = await DbHelper.getUserByEmail(userEmail);
      if (!user) {
        throw new Error("User not found");
      }
      await DbHelper.updateUser(userEmail, { spreadsheetId });
    } catch (error: any) {
      console.error("Error setting spreadsheet ID for user:", error);
      throw new Error(`Failed to set spreadsheet ID: ${error.message}`);
    }
  }
}

// ============================================================================
// BACKWARD COMPATIBILITY - Export alias for old GoogleOAuthHelper usage
// ============================================================================
export { GoogleAuthHelper as GoogleOAuthHelper };
