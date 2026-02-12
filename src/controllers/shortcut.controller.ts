import { Request, Response } from "express";
import { DbHelper } from "../helpers/db.helper";
import { TransactionsHelper, AccountsHelper } from "../helpers/mybalance";
import { GoogleAuthHelper, GoogleTokenError } from "../helpers/google";
import { IAccount } from "../models";
import crypto from "crypto";

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

/**
 * ShortcutController
 * Handles iOS Shortcuts integration for quick movement creation
 * Uses shortcut key authentication instead of JWT
 */
export class ShortcutController {
  /**
   * Generate a new shortcut key for the user
   */
  static async generateShortcutKey(req: Request, res: Response): Promise<void> {
    try {
      const userEmail = (req as any).userId; // From auth middleware

      // Generate a secure random key (32 bytes = 64 hex chars)
      const shortcutKey = crypto.randomBytes(32).toString("hex");

      // Save to database
      await DbHelper.updateShortcutKey(userEmail, shortcutKey);

      res.json({
        success: true,
        data: {
          shortcutKey,
        },
      });
    } catch (error: any) {
      console.error("Error generating shortcut key:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to generate shortcut key",
      });
    }
  }

  /**
   * Get current shortcut key for the user
   */
  static async getShortcutKey(req: Request, res: Response): Promise<void> {
    try {
      const userEmail = (req as any).userId; // From auth middleware

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
        data: {
          shortcutKey: user.shortcut_key || null,
        },
      });
    } catch (error: any) {
      console.error("Error fetching shortcut key:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch shortcut key",
      });
    }
  }

  /**
   * Create a movement via iOS Shortcut
   * Uses x-shortcutkey header for authentication
   */
  static async createMovementViaShortcut(
    req: Request,
    res: Response,
  ): Promise<void> {
    try {
      const shortcutKey = req.headers["x-shortcutkey"] as string;

      if (!shortcutKey) {
        res.status(401).json({
          success: false,
          error: "Missing x-shortcutkey header",
        });
        return;
      }

      // Find user by shortcut key
      const user = await DbHelper.getUserByShortcutKey(shortcutKey);
      if (!user) {
        res.status(401).json({
          success: false,
          error: "Invalid shortcut key",
        });
        return;
      }

      const spreadsheetId = user.spreadsheet_id;
      if (!spreadsheetId) {
        res.status(400).json({
          success: false,
          error: "User has no spreadsheet configured",
        });
        return;
      }

      // Extract movement data from request
      const {
        amount,
        description = "",
        category = "",
        account = "",
        location = "",
        date = new Date().toLocaleDateString("it-IT"), // dd-MM-yyyy format
      } = req.body;

      if (!amount) {
        res.status(400).json({
          success: false,
          error: "Amount is required",
        });
        return;
      }

      // Get session for this user to retrieve Google tokens
      const deviceType = "ios"; // Assume iOS for shortcut

      // Get user's accounts and find the best matching account
      const accounts = await GoogleAuthHelper.executeWithRetry(
        user.email,
        deviceType,
        async (client) => AccountsHelper.getAccounts(spreadsheetId, client),
      );
      const matchedAccount = ShortcutController.findBestAccountMatch(
        account,
        accounts,
      );

      console.log(
        `🔍 Account matching: input="${account}" -> matched="${matchedAccount}"`,
      );

      // Create movement with "unconfirmed" status
      const movement = {
        description,
        category,
        date,
        location,
        status: "unconfirmed", // Mark as unconfirmed for later review
        transactions: [
          {
            amount: amount.toString(),
            account: matchedAccount,
            description,
            category,
            date,
            location,
            _operation: "create" as const,
          },
        ],
      };

      // Save movement to Google Sheets using TransactionsHelper
      const result = await GoogleAuthHelper.executeWithRetry(
        user.email,
        deviceType,
        async (client) =>
          TransactionsHelper.appendMovement(client, spreadsheetId, movement),
      );

      // Send push notification if user has a push token
      if (user.push_token) {
        try {
          await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              to: user.push_token,
              title: "MyBalance",
              body: "There is a new unconfirmed movement to be reviewed",
              sound: "default",
            }),
          });
        } catch (pushError) {
          console.error("Error sending push notification:", pushError);
          // Don't fail the request if push notification fails
        }
      }

      res.json({
        success: true,
        data: result,
        message: "Movement created successfully via shortcut",
      });
    } catch (error: any) {
      if (handleGoogleTokenError(error, res, "createMovementViaShortcut"))
        return;
      console.error("Error creating movement via shortcut:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to create movement",
      });
    }
  }

  /**
   * Find the best matching account name from user's accounts
   * Priority: exact match > partial match > first account (default)
   */
  private static findBestAccountMatch(
    inputAccount: string,
    accounts: IAccount[],
  ): string {
    if (!accounts.length) return "";
    if (!inputAccount?.trim()) return accounts[0].name;

    const input = inputAccount.toLowerCase().trim();

    // 1. Exact match (case insensitive)
    const exactMatch = accounts.find((a) => a.name.toLowerCase() === input);
    if (exactMatch) return exactMatch.name;

    // 2. Partial match (input contains account name or vice versa)
    const partialMatch = accounts.find(
      (a) =>
        a.name.toLowerCase().includes(input) ||
        input.includes(a.name.toLowerCase()),
    );
    if (partialMatch) return partialMatch.name;

    // 3. Fallback to first account (default)
    return accounts[0].name;
  }
}
