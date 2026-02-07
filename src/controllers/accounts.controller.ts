import { Request, Response } from "express";
import { AccountsHelper, TransactionsHelper } from "../helpers/mybalance";
import { GoogleAuthHelper, GoogleTokenError } from "../helpers/google";

// Helper to handle Google token errors and return appropriate HTTP status
function handleGoogleTokenError(
  error: any,
  res: Response,
  context: string,
): boolean {
  if (error instanceof GoogleTokenError) {
    console.error(
      `❌ Google token error in ${context}:`,
      error.message,
      error.code,
    );
    res.status(401).json({
      success: false,
      error: error.message,
      code: error.code,
      requiresReauth: true,
    });
    return true;
  }
  return false;
}

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

      // Parse calculate_balance parameter (default: true for backward compatibility)
      const calculateBalance = req.query.calculate_balance !== "false";
      console.log("📊 Calculate balance:", calculateBalance);

      // Get all accounts using AccountsHelper
      const accounts = await GoogleAuthHelper.executeWithRetry(
        userEmail,
        deviceType,
        async (client) =>
          AccountsHelper.getAccounts(spreadsheetId, client, calculateBalance),
      );

      console.log("💰 Accounts fetched successfully:", accounts.length);
      res.json({ success: true, data: accounts });
    } catch (error: any) {
      if (handleGoogleTokenError(error, res, "getAccounts")) return;
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

      // Create new account using AccountsHelper
      const account = await GoogleAuthHelper.executeWithRetry(
        userEmail,
        deviceType,
        async (client) => {
          // Get refresh token from auth client
          const refreshToken = (client as any).credentials.refresh_token;
          if (!refreshToken) {
            throw new Error("No refresh token found for user");
          }

          return AccountsHelper.createAccount(spreadsheetId, refreshToken, {
            name: name || "Unnamed Account",
            description: description || "",
            balance: balance || "0,00",
            color: color || "#808080",
            textColor: textColor || "#ffffff",
          });
        },
      );

      res.json({ success: true, data: account });
    } catch (error: any) {
      if (handleGoogleTokenError(error, res, "createAccount")) return;
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

      // Se è prevista la modifica del nome, recupera prima l'account corrente
      let oldAccountName: string | null = null;
      if (updateData.name) {
        const accounts = await GoogleAuthHelper.executeWithRetry(
          userEmail,
          deviceType,
          async (client) => AccountsHelper.getAccounts(spreadsheetId, client),
        );
        const currentAccount = accounts.find(
          (acc) => acc.accountId === accountId,
        );
        if (currentAccount && currentAccount.name !== updateData.name) {
          oldAccountName = currentAccount.name;
          console.log(
            `📊 Account name change detected: "${oldAccountName}" -> "${updateData.name}"`,
          );
        }
      }

      // Update account using AccountsHelper
      const updatedAccount = await GoogleAuthHelper.executeWithRetry(
        userEmail,
        deviceType,
        async (client) => {
          // Get refresh token from auth client
          const refreshToken = (client as any).credentials.refresh_token;
          if (!refreshToken) {
            throw new Error("No refresh token found for user");
          }

          return AccountsHelper.updateAccount(
            spreadsheetId,
            refreshToken,
            accountId,
            updateData,
          );
        },
      );

      // Se il nome è cambiato, aggiorna tutte le transazioni con il nuovo nome
      if (oldAccountName && updateData.name) {
        console.log(
          `📊 Updating transactions from account "${oldAccountName}" to "${updateData.name}"`,
        );
        const updatedCount = await GoogleAuthHelper.executeWithRetry(
          userEmail,
          deviceType,
          async (client) =>
            TransactionsHelper.updateTransactionsAccountName(
              client,
              spreadsheetId,
              oldAccountName,
              updateData.name,
            ),
        );
        console.log(
          `📊 Updated ${updatedCount} transactions with new account name`,
        );
      }

      console.log("💰 Account updated successfully:", updatedAccount.name);
      res.json({ success: true, data: updatedAccount });
    } catch (error: any) {
      if (handleGoogleTokenError(error, res, "updateAccount")) return;
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

      // Delete account using AccountsHelper
      await GoogleAuthHelper.executeWithRetry(
        userEmail,
        deviceType,
        async (client) => {
          // Get refresh token from auth client
          const refreshToken = (client as any).credentials.refresh_token;
          if (!refreshToken) {
            throw new Error("No refresh token found for user");
          }

          return AccountsHelper.deleteAccount(
            spreadsheetId,
            refreshToken,
            accountId,
          );
        },
      );

      res.json({ success: true, message: "Account deleted successfully" });
    } catch (error: any) {
      if (handleGoogleTokenError(error, res, "deleteAccount")) return;
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

      // Create accounts batch using AccountsHelper
      const createdAccounts = await GoogleAuthHelper.executeWithRetry(
        userEmail,
        deviceType,
        async (client) => {
          // Get refresh token from auth client
          const refreshToken = (client as any).credentials.refresh_token;
          if (!refreshToken) {
            throw new Error("No refresh token found for user");
          }

          return AccountsHelper.createAccountsBatch(
            spreadsheetId,
            refreshToken,
            accounts,
          );
        },
      );

      res.json({ success: true, data: createdAccounts });
    } catch (error: any) {
      if (handleGoogleTokenError(error, res, "createAccountsBatch")) return;
      console.error("Error creating accounts batch:", error);
      res.status(500).json({
        error: "Failed to create accounts",
        details: error.message,
      });
    }
  }
}
