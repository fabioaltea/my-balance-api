import { OAuth2Client, OAuth2ClientOptions } from "google-auth-library";
import { TokenPayload } from "google-auth-library";

export interface GoogleTokens {
  idToken: string;
  refreshToken?: string;
  scopes: string[];
}

export interface GoogleIdentity {
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

export interface ExchangeCodeParams {
  authorizationCode: string;
  codeVerifier?: string; // Optional for PKCE support
}

export class GoogleOAuthHelper {
  private client: OAuth2Client;

  public getClient(): OAuth2Client {
    return this.client;
  }

  private loadWebClient(): void {
    console.log("Loading web OAuth2 client with params:", {
      clientId: process.env.CLIENT_ID_WEB,
      clientSecret: process.env.CLIENT_SECRET,
      redirectUri: process.env.REDIRECT_URI_WEB,
    });
    this.client = new OAuth2Client(
      process.env.CLIENT_ID_WEB,
      process.env.CLIENT_SECRET,
      process.env.REDIRECT_URI_WEB
    );
  }

  private loadIOSClient(): void {
    console.log("Loading iOS OAuth2 client with params:", {
      clientId: process.env.CLIENT_ID_IOS,
      redirectUri: process.env.REDIRECT_URI_IOS,
    });
    this.client = new OAuth2Client({
      client_id: process.env.CLIENT_ID_IOS,
      redirectUri: process.env.REDIRECT_URI_IOS,
    } as OAuth2ClientOptions);
  }

  private loadAndroidClient(): void {
    console.log("Loading Android OAuth2 client with params:", {
      clientId: process.env.CLIENT_ID_ANDROID,
      redirectUri:
        process.env.REDIRECT_URI_ANDROID || process.env.REDIRECT_URI_IOS,
    });
    this.client = new OAuth2Client({
      client_id: process.env.CLIENT_ID_ANDROID,
      redirectUri:
        process.env.REDIRECT_URI_ANDROID || process.env.REDIRECT_URI_IOS,
    } as OAuth2ClientOptions);
  }

  constructor(deviceType: "ios" | "android" | "web") {
    console.log("Initializing GoogleOAuthHelper for device type:", deviceType);
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

  /**
   * Exchange authorization code for Google tokens
   */
  public async exchangeCodeForTokens(
    params: ExchangeCodeParams
  ): Promise<GoogleTokens> {
    try {
      // Prepare token request - only include codeVerifier if provided (for PKCE)
      const tokenRequest: any = {
        code: params.authorizationCode,
      };

      // Only add codeVerifier if it's provided and not empty
      if (params.codeVerifier && params.codeVerifier.trim()) {
        tokenRequest.codeVerifier = params.codeVerifier;
        console.log(
          "Using PKCE code verifier for token exchange:",
          tokenRequest.codeVerifier
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
        error.response?.data?.error_description || error.message
      );
      throw new Error(
        `Failed to exchange authorization code: ${error.message}`
      );
    }
  }

  /**
   * Verify Google ID token and extract identity information
   */
  public async verifyIdToken(idToken: string): Promise<GoogleIdentity> {
    console.log(
      "Verifying ID token:",
      idToken,
      "for client",
      this.client._clientId
    );
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
}
