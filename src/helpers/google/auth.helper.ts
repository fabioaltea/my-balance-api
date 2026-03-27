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
  private static readonly AUTH_ERROR_STATUSES = new Set([401, 403]);

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
        console.log(
          "Using custom redirect URI for token exchange:",
          params.redirectUri,
        );
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
      const errorMessage = GoogleAuthHelper.extractErrorMessage(error);
      const errorStatus = GoogleAuthHelper.extractErrorStatus(error);
      const isTokenInvalid =
        errorMessage.includes("invalid_grant") ||
        errorMessage.includes("token has been expired or revoked") ||
        errorMessage.includes("token has been revoked") ||
        errorMessage.includes("invalid credentials") ||
        GoogleAuthHelper.AUTH_ERROR_STATUSES.has(errorStatus ?? -1);

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
  // RETRY WRAPPER - Execute API calls with automatic token refresh on auth errors
  // ============================================================================

  // Track ongoing refresh operations per user to avoid concurrent refreshes
  private static refreshLocks: Map<string, Promise<void>> = new Map();

  private static extractErrorMessage(error: any): string {
    return [
      error?.message,
      error?.response?.data?.error_description,
      error?.response?.data?.error,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  private static extractErrorStatus(error: any): number | undefined {
    const rawStatus = error?.response?.status ?? error?.status ?? error?.code;

    if (typeof rawStatus === "number") {
      return rawStatus;
    }

    if (typeof rawStatus === "string") {
      const parsedStatus = Number(rawStatus);
      return Number.isNaN(parsedStatus) ? undefined : parsedStatus;
    }

    return undefined;
  }

  private static isAuthError(error: any): boolean {
    const errorMessage = GoogleAuthHelper.extractErrorMessage(error);
    const errorStatus = GoogleAuthHelper.extractErrorStatus(error);

    return (
      GoogleAuthHelper.AUTH_ERROR_STATUSES.has(errorStatus ?? -1) ||
      errorMessage.includes("unauthorized_client") ||
      errorMessage.includes("invalid_grant") ||
      errorMessage.includes("invalid credentials") ||
      (errorMessage.includes("token") && errorMessage.includes("expired")) ||
      (errorMessage.includes("token") && errorMessage.includes("revoked"))
    );
  }

  private static toGoogleTokenError(error: any, fallbackMessage: string): GoogleTokenError {
    if (error instanceof GoogleTokenError) {
      return error;
    }

    const status = GoogleAuthHelper.extractErrorStatus(error);
    const message = error?.message || fallbackMessage;
    const code =
      status === 403 ? "GOOGLE_AUTH_FORBIDDEN" : "GOOGLE_TOKEN_INVALID";

    return new GoogleTokenError(message, code);
  }

  /**
   * Execute a Google API call with automatic retry on authentication errors
   * Handles token refresh and rotation transparently
   *
   * @param userEmail - User email for token management
   * @param deviceType - Device type for client configuration
   * @param apiCall - Async function that performs the API call
   * @returns Result of the API call
   */
  public static async executeWithRetry<T>(
    userEmail: string,
    deviceType: DeviceType,
    apiCall: (client: OAuth2Client) => Promise<T>,
  ): Promise<T> {
    // Get the auth client (without preventive refresh)
    let client = await GoogleAuthHelper.getAuthClientForUser(
      userEmail,
      deviceType,
    );

    try {
      // Try the API call first
      return await apiCall(client);
    } catch (error: any) {
      // Check if this is an authentication error that requires token refresh
      const isAuthError = GoogleAuthHelper.isAuthError(error);

      if (!isAuthError) {
        // Not an auth error, just throw it
        throw error;
      }

      console.log(
        `🔄 Auth error detected for ${userEmail}, attempting token refresh and retry...`,
      );

      // Use lock to prevent concurrent refresh attempts for the same user
      const lockKey = `${userEmail}:${deviceType}`;
      const existingLock = GoogleAuthHelper.refreshLocks.get(lockKey);

      if (existingLock) {
        // Wait for ongoing refresh to complete
        await existingLock;
        // Get fresh client after lock is released
        client = await GoogleAuthHelper.getAuthClientForUser(
          userEmail,
          deviceType,
        );
        // Retry with refreshed client
        try {
          return await apiCall(client);
        } catch (retryError: any) {
          if (GoogleAuthHelper.isAuthError(retryError)) {
            throw GoogleAuthHelper.toGoogleTokenError(
              retryError,
              "Google authentication failed after token refresh. User must re-authenticate.",
            );
          }
          throw retryError;
        }
      }

      // Create new lock for this refresh operation
      const refreshPromise = (async () => {
        try {
          // Create a new helper to perform the refresh
          const helper = new GoogleAuthHelper(deviceType);

          // Get and decrypt refresh token
          const encryptedToken = await DbHelper.getGoogleRefreshToken(
            userEmail,
            deviceType,
          );

          if (!encryptedToken) {
            throw new GoogleTokenError(
              `No refresh token found for ${userEmail}`,
              "GOOGLE_TOKEN_NOT_FOUND",
            );
          }

          const refreshToken = CryptoHelper.decrypt(encryptedToken);
          helper.setCredentials(refreshToken);

          // Perform the refresh
          const refreshResult = await helper.refreshAccessToken();

          // Handle token rotation if Google returned a new refresh token
          if (refreshResult.newRefreshToken) {
            console.log(
              `💾 Saving rotated refresh token for ${userEmail} (${deviceType})`,
            );
            const encryptedNewToken = CryptoHelper.encrypt(
              refreshResult.newRefreshToken,
            );
            await DbHelper.storeGoogleRefreshToken(
              userEmail,
              encryptedNewToken,
              deviceType,
            );
            console.log("✅ Rotated refresh token saved");
          }
        } catch (refreshError: any) {
          console.error("Failed to refresh token:", refreshError);
          throw refreshError;
        } finally {
          // Remove lock when done
          GoogleAuthHelper.refreshLocks.delete(lockKey);
        }
      })();

      // Store the lock
      GoogleAuthHelper.refreshLocks.set(lockKey, refreshPromise);

      // Wait for refresh to complete
      await refreshPromise;

      // Get fresh client with refreshed token
      client = await GoogleAuthHelper.getAuthClientForUser(
        userEmail,
        deviceType,
      );

      // Retry the API call with refreshed credentials
      console.log(
        `♻️  Retrying API call for ${userEmail} with refreshed token`,
      );
      try {
        return await apiCall(client);
      } catch (retryError: any) {
        if (GoogleAuthHelper.isAuthError(retryError)) {
          throw GoogleAuthHelper.toGoogleTokenError(
            retryError,
            "Google authentication failed after token refresh. User must re-authenticate.",
          );
        }
        throw retryError;
      }
    }
  }

  // ============================================================================
  // STATIC METHODS - Database operations & authenticated client factory
  // ============================================================================

  /**
   * Get an authenticated OAuth2 client for a user (with refresh token from DB)
   * This is the main method for making API calls (Sheets, etc.)
   * Note: Token refresh happens lazily when API calls fail (handled by retry wrapper)
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
      // OAuth2Client will automatically refresh when needed during API calls
      helper.setCredentials(refreshToken);

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
