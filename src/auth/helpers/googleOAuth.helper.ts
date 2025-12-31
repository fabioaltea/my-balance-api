import { OAuth2Client } from "google-auth-library";
import { TokenPayload } from "google-auth-library";

export interface GoogleTokens {
  idToken: string;
  refreshToken?: string;
  scopes: string[];
}

export interface GoogleIdentity {
  googleSub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

export interface ExchangeCodeParams {
  authorizationCode: string;
  codeVerifier?: string; // Optional for PKCE support
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export class GoogleOAuthHelper {
  private static client: OAuth2Client;

  private static getClient(): OAuth2Client {
    if (!this.client) {
      this.client = new OAuth2Client(
        process.env.CLIENT_ID,
        process.env.CLIENT_SECRET,
        process.env.REDIRECT_URI
      );
    }
    return this.client;
  }

  /**
   * Exchange authorization code for Google tokens
   */
  public static async exchangeCodeForTokens(
    params: ExchangeCodeParams
  ): Promise<GoogleTokens> {
    const client = this.getClient();

    try {
      // Prepare token request - only include codeVerifier if provided (for PKCE)
      const tokenRequest: any = {
        code: params.authorizationCode,
      };

      // Only add codeVerifier if it's provided and not empty
      if (params.codeVerifier && params.codeVerifier.trim()) {
        tokenRequest.codeVerifier = params.codeVerifier;
      }

      const { tokens } = await client.getToken(tokenRequest);

      if (!tokens.id_token) {
        throw new Error("No ID token received from Google");
      }

      return {
        idToken: tokens.id_token,
        refreshToken: tokens.refresh_token || undefined,
        scopes: tokens.scope?.split(" ") || [],
      };
    } catch (error: any) {
      console.error("Error exchanging authorization code:", error);
      throw new Error(
        `Failed to exchange authorization code: ${error.message}`
      );
    }
  }

  /**
   * Verify Google ID token and extract identity information
   */
  public static async verifyIdToken(idToken: string): Promise<GoogleIdentity> {
    const client = this.getClient();

    try {
      const ticket = await client.verifyIdToken({
        idToken: idToken,
        audience: process.env.CLIENT_ID,
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
      if (payload.aud !== process.env.CLIENT_ID) {
        throw new Error("Invalid token audience");
      }

      if (!payload.sub || !payload.email) {
        throw new Error("Missing required fields in ID token");
      }

      return {
        googleSub: payload.sub,
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
