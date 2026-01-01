import { GoogleAuth, JWT } from "google-auth-library";
import { google } from "googleapis";
import { CryptoHelper } from "../auth/helpers/crypto.helper";
import { DbHelper } from "./DbHelper";

export class GoogleAuthHelper {
  /**
   * Get Google OAuth2 client for authenticated user
   */
  public static async getAuthClientForUser(userEmail: string) {
    try {
      // Get encrypted refresh token from database
      const encryptedToken = await DbHelper.getGoogleRefreshToken(userEmail);

      if (!encryptedToken) {
        throw new Error("No Google refresh token found for user");
      }

      // Decrypt the refresh token
      const refreshToken = CryptoHelper.decrypt(encryptedToken);

      // Create OAuth2 client
      const oauth2Client = new google.auth.OAuth2(
        process.env.CLIENT_ID,
        process.env.CLIENT_SECRET,
        process.env.REDIRECT_URI
      );

      // Set the refresh token
      oauth2Client.setCredentials({
        refresh_token: refreshToken,
      });

      // Refresh access token if needed
      await oauth2Client.getAccessToken();

      return oauth2Client;
    } catch (error: any) {
      console.error("Error getting auth client for user:", error);
      throw new Error(`Failed to get Google auth client: ${error.message}`);
    }
  }

  /**
   * Get user's spreadsheet ID from database
   */
  public static async getSpreadsheetIdForUser(
    userEmail: string
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
    spreadsheetId: string
  ): Promise<void> {
    try {
      // First get the user to make sure they exist, then update
      const user = await DbHelper.getUserByEmail(userEmail);
      if (!user) {
        throw new Error("User not found");
      }
      // Use the spreadsheetId parameter in update - need to add this to interface
      await DbHelper.updateUser(userEmail, { spreadsheetId });
    } catch (error: any) {
      console.error("Error setting spreadsheet ID for user:", error);
      throw new Error(`Failed to set spreadsheet ID: ${error.message}`);
    }
  }
}
