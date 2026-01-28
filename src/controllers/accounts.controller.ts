import { Request, Response } from "express";
import { AccountsHelper, TransactionsHelper } from "../helpers/mybalance";
import { GoogleAuthHelper } from "../helpers/google";

export class AccountsController {
  /**
   * GET /accounts - Recupera tutti gli accounts
   */
  public static async getAccounts(req: any, res: Response): Promise<void> {
    try {
      console.log("💰 =============");
      console.log("💰 GET /accounts endpoint hit!");
      console.log("💰 User ID:", req.userId);
      console.log("💰 Device Type:", req.deviceType);
      console.log("💰 Query params:", req.query);
      console.log("💰 =============");

      const userEmail = req.userId;

      // Get user's Google auth client with proper credentials
      const deviceType = req.deviceType || "web";
      const authClient = await GoogleAuthHelper.getAuthClientForUser(
        userEmail,
        deviceType,
      );

      // Get spreadsheet ID - either from query or user's default
      let spreadsheetId = req.query.spreadsheet_id;
      if (!spreadsheetId) {
        spreadsheetId =
          await GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
      }

      if (!spreadsheetId) {
        res.status(400).json({
          success: false,
          error:
            "No spreadsheet ID provided and no default spreadsheet configured",
        });
        return;
      }

      console.log("📊 Reading accounts from spreadsheet:", spreadsheetId);

      // Get all accounts using AccountsHelper
      const accounts = await AccountsHelper.getAccounts(
        spreadsheetId,
        authClient,
      );

      console.log("💰 Accounts fetched successfully:", accounts.length);
      res.json({ success: true, data: accounts });
    } catch (error: any) {
      console.error("Error fetching accounts:", error);
      res.status(500).json({
        error: "Failed to fetch accounts",
        details: error?.message,
      });
    }
  }

  /**
   * POST /accounts - Crea nuovo account
   */
  public static async createAccount(req: any, res: Response): Promise<void> {
    try {
      const userEmail = req.userId;
      const { name, description, balance, color, textColor } = req.body;

      // Get user's Google auth client
      const deviceType = req.deviceType || "web";
      const authClient = await GoogleAuthHelper.getAuthClientForUser(
        userEmail,
        deviceType,
      );

      // Get spreadsheet ID - either from query or user's default
      let spreadsheetId = req.query.spreadsheet_id;
      if (!spreadsheetId) {
        spreadsheetId =
          await GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
      }

      if (!spreadsheetId) {
        res.status(400).json({
          success: false,
          error:
            "No spreadsheet ID provided and no default spreadsheet configured",
        });
        return;
      }

      // Get refresh token from auth client
      const refreshToken = (authClient as any).credentials.refresh_token;
      if (!refreshToken) {
        res.status(401).json({
          success: false,
          error: "No refresh token found for user",
        });
        return;
      }

      // Create new account using AccountsHelper
      const account = await AccountsHelper.createAccount(
        spreadsheetId,
        refreshToken,
        {
          name: name || "Unnamed Account",
          description: description || "",
          balance: balance || "0,00",
          color: color || "#808080",
          textColor: textColor || "#ffffff",
        },
      );

      res.json({ success: true, data: account });
    } catch (error) {
      console.error("Error creating account:", error);
      res.status(500).json({
        error: "Failed to create account",
        details: error.message,
      });
    }
  }

  /**
   * PUT /accounts/:accountId - Aggiorna account esistente
   */
  public static async updateAccount(req: any, res: Response): Promise<void> {
    try {
      console.log("💰 =============");
      console.log("💰 PUT /accounts/:accountId endpoint hit!");
      console.log("💰 User ID:", req.userId);
      console.log("💰 Device Type:", req.deviceType);
      console.log("💰 Account ID:", req.params.accountId);
      console.log("💰 =============");

      const userEmail = req.userId;
      const { accountId } = req.params;
      const updateData = req.body;

      // Get user's Google auth client with proper credentials
      const deviceType = req.deviceType || "web";
      const authClient = await GoogleAuthHelper.getAuthClientForUser(
        userEmail,
        deviceType,
      );

      // Get spreadsheet ID - either from query or user's default
      let spreadsheetId = req.query.spreadsheet_id;
      if (!spreadsheetId) {
        spreadsheetId =
          await GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
      }

      if (!spreadsheetId) {
        res.status(400).json({
          success: false,
          error:
            "No spreadsheet ID provided and no default spreadsheet configured",
        });
        return;
      }

      console.log("📊 Updating account in spreadsheet:", spreadsheetId);

      // Get refresh token from auth client
      const refreshToken = (authClient as any).credentials.refresh_token;
      if (!refreshToken) {
        res.status(401).json({
          success: false,
          error: "No refresh token found for user",
        });
        return;
      }

      // Se è prevista la modifica del nome, recupera prima l'account corrente
      let oldAccountName: string | null = null;
      if (updateData.name) {
        const accounts = await AccountsHelper.getAccounts(
          spreadsheetId,
          authClient,
        );
        const currentAccount = accounts.find((acc) => acc.accountId === accountId);
        if (currentAccount && currentAccount.name !== updateData.name) {
          oldAccountName = currentAccount.name;
          console.log(
            `📊 Account name change detected: "${oldAccountName}" -> "${updateData.name}"`,
          );
        }
      }

      // Update account using AccountsHelper
      const updatedAccount = await AccountsHelper.updateAccount(
        spreadsheetId,
        refreshToken,
        accountId,
        updateData,
      );

      // Se il nome è cambiato, aggiorna tutte le transazioni con il nuovo nome
      if (oldAccountName && updateData.name) {
        console.log(
          `📊 Updating transactions from account "${oldAccountName}" to "${updateData.name}"`,
        );
        const updatedCount =
          await TransactionsHelper.updateTransactionsAccountName(
            authClient,
            spreadsheetId,
            oldAccountName,
            updateData.name,
          );
        console.log(`📊 Updated ${updatedCount} transactions with new account name`);
      }

      console.log("💰 Account updated successfully:", updatedAccount.name);
      res.json({ success: true, data: updatedAccount });
    } catch (error) {
      console.error("Error updating account:", error);
      res.status(500).json({
        error: "Failed to update account",
        details: error.message,
      });
    }
  }

  /**
   * DELETE /accounts/:accountId - Elimina account
   */
  public static async deleteAccount(req: any, res: Response): Promise<void> {
    try {
      const userEmail = req.userId;
      const { accountId } = req.params;

      // Get spreadsheet ID - either from query or user's default
      let spreadsheetId = req.query.spreadsheet_id;
      if (!spreadsheetId) {
        spreadsheetId =
          await GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
      }

      if (!spreadsheetId) {
        res.status(400).json({
          success: false,
          error:
            "No spreadsheet ID provided and no default spreadsheet configured",
        });
        return;
      }

      // Get user's Google auth client
      const deviceType = req.deviceType || "web";
      const authClient = await GoogleAuthHelper.getAuthClientForUser(
        userEmail,
        deviceType,
      );

      // Get refresh token from auth client
      const refreshToken = (authClient as any).credentials.refresh_token;
      if (!refreshToken) {
        res.status(401).json({
          success: false,
          error: "No refresh token found for user",
        });
        return;
      }

      // Delete account using AccountsHelper
      await AccountsHelper.deleteAccount(
        spreadsheetId,
        refreshToken,
        accountId,
      );

      res.json({ success: true, message: "Account deleted successfully" });
    } catch (error) {
      console.error("Error deleting account:", error);
      res.status(500).json({
        error: "Failed to delete account",
        details: error.message,
      });
    }
  }

  /**
   * POST /accounts/batch - Crea multipli accounts in batch
   */
  public static async createAccountsBatch(
    req: any,
    res: Response,
  ): Promise<void> {
    try {
      const userEmail = req.userId;
      const { accounts } = req.body;

      // Get spreadsheet ID - either from query or user's default
      let spreadsheetId = req.query.spreadsheet_id;
      if (!spreadsheetId) {
        spreadsheetId =
          await GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
      }

      if (!spreadsheetId) {
        res.status(400).json({
          success: false,
          error:
            "No spreadsheet ID provided and no default spreadsheet configured",
        });
        return;
      }

      // Get user's Google auth client
      const deviceType = req.deviceType || "web";
      const authClient = await GoogleAuthHelper.getAuthClientForUser(
        userEmail,
        deviceType,
      );

      // Get refresh token from auth client
      const refreshToken = (authClient as any).credentials.refresh_token;
      if (!refreshToken) {
        res.status(401).json({
          success: false,
          error: "No refresh token found for user",
        });
        return;
      }

      // Create accounts batch using AccountsHelper
      const createdAccounts = await AccountsHelper.createAccountsBatch(
        spreadsheetId,
        refreshToken,
        accounts,
      );

      res.json({ success: true, data: createdAccounts });
    } catch (error) {
      console.error("Error creating accounts batch:", error);
      res.status(500).json({
        error: "Failed to create accounts",
        details: error.message,
      });
    }
  }
}
