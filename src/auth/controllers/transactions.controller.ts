import { Request, Response } from "express";
import { TransactionsHelper } from "../../helpers/MyBalance/TransactionsHelper";
import { GoogleAuthHelper } from "../../helpers/GoogleAuthHelper";

export class TransactionsController {
  /**
   * GET /transactions - Restituisce tutte le transazioni
   */
  public static async getTransactions(req: any, res: Response): Promise<void> {
    try {
      console.log("🔄 =============");
      console.log("🔄 GET /transactions endpoint hit!");
      console.log("🔄 User ID:", req.userId);
      console.log("🔄 Device Type:", req.deviceType);
      console.log("🔄 Query params:", req.query);
      console.log("🔄 =============");

      const userEmail = req.userId;

      // Get user's Google auth client
      const deviceType = req.deviceType || "web";
      const authClient = await GoogleAuthHelper.getAuthClientForUser(
        userEmail,
        deviceType
      );

      // Get spreadsheet ID - either from query or user's default
      let spreadsheetId = req.query.spreadsheet_id;
      if (!spreadsheetId) {
        spreadsheetId = await GoogleAuthHelper.getSpreadsheetIdForUser(
          userEmail
        );
      }

      if (!spreadsheetId) {
        res.status(400).json({
          success: false,
          error:
            "Missing spreadsheet_id in query params and no default spreadsheet configured",
        });
        return;
      }

      console.log("🔄 Loading transactions for spreadsheet:", spreadsheetId);

      // Get all transactions using TransactionsHelper
      const allTransactions = await TransactionsHelper.listTransactions(
        authClient,
        spreadsheetId
      );

      console.log(
        "🔄 Transactions loaded successfully:",
        allTransactions.length
      );

      res.json({ success: true, data: allTransactions });
    } catch (error: any) {
      console.error("❌ Error fetching transactions:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch transactions",
        details: error?.message,
      });
    }
  }

  /**
   * POST /transactions - Crea nuova transazione
   */
  public static async createTransaction(
    req: any,
    res: Response
  ): Promise<void> {
    try {
      const userEmail = req.userId;
      const transactionData = req.body;

      // Get user's Google auth client
      const deviceType = req.deviceType || "web";
      const authClient = await GoogleAuthHelper.getAuthClientForUser(
        userEmail,
        deviceType
      );

      // Get spreadsheet ID - either from query or user's default
      let spreadsheetId = req.query.spreadsheet_id;
      if (!spreadsheetId) {
        spreadsheetId = await GoogleAuthHelper.getSpreadsheetIdForUser(
          userEmail
        );
      }

      if (!spreadsheetId) {
        res.status(400).json({
          success: false,
          error:
            "No spreadsheet ID provided and no default spreadsheet configured",
        });
        return;
      }

      // Create transaction using TransactionsHelper
      const result = await TransactionsHelper.appendMovement(
        authClient,
        spreadsheetId,
        transactionData
      );

      res.json({ success: true, data: result });
    } catch (error) {
      console.error("Error creating transaction:", error);
      res.status(500).json({
        error: "Failed to create transaction",
        details: error.message,
      });
    }
  }

  /**
   * PUT /transactions/:transactionId - Aggiorna transazione esistente
   */
  public static async updateTransaction(
    req: any,
    res: Response
  ): Promise<void> {
    try {
      const userEmail = req.userId;
      const { transactionId } = req.params;
      const updateData = req.body;

      // Get user's Google auth client
      const deviceType = req.deviceType || "web";
      const authClient = await GoogleAuthHelper.getAuthClientForUser(
        userEmail,
        deviceType
      );

      // Get spreadsheet ID - either from query or user's default
      let spreadsheetId = req.query.spreadsheet_id;
      if (!spreadsheetId) {
        spreadsheetId = await GoogleAuthHelper.getSpreadsheetIdForUser(
          userEmail
        );
      }

      if (!spreadsheetId) {
        res.status(400).json({
          success: false,
          error:
            "No spreadsheet ID provided and no default spreadsheet configured",
        });
        return;
      }

      // Update transaction using TransactionsHelper
      const updatedTransaction = await TransactionsHelper.updateMovement(
        authClient,
        spreadsheetId,
        updateData
      );

      res.json({ success: true, data: updatedTransaction });
    } catch (error) {
      console.error("Error updating transaction:", error);
      res.status(500).json({
        error: "Failed to update transaction",
        details: error.message,
      });
    }
  }

  /**
   * DELETE /transactions/:transactionId - Elimina transazione
   */
  public static async deleteTransaction(
    req: any,
    res: Response
  ): Promise<void> {
    try {
      const userEmail = req.userId;
      const { transactionId } = req.params;

      // Get user's Google auth client
      const deviceType = req.deviceType || "web";
      const authClient = await GoogleAuthHelper.getAuthClientForUser(
        userEmail,
        deviceType
      );

      // Get spreadsheet ID - either from query or user's default
      let spreadsheetId = req.query.spreadsheet_id;
      if (!spreadsheetId) {
        spreadsheetId = await GoogleAuthHelper.getSpreadsheetIdForUser(
          userEmail
        );
      }

      if (!spreadsheetId) {
        res.status(400).json({
          success: false,
          error:
            "No spreadsheet ID provided and no default spreadsheet configured",
        });
        return;
      }

      // Delete transaction using TransactionsHelper
      await TransactionsHelper.deleteMovement(
        authClient,
        spreadsheetId,
        transactionId
      );

      res.json({ success: true, message: "Transaction deleted successfully" });
    } catch (error) {
      console.error("Error deleting transaction:", error);
      res.status(500).json({
        error: "Failed to delete transaction",
        details: error.message,
      });
    }
  }

  /**
   * GET /transactions/:transactionId - Recupera singola transazione
   */
  public static async getTransaction(req: any, res: Response): Promise<void> {
    try {
      const userEmail = req.userId;
      const { transactionId } = req.params;

      // Get user's Google auth client
      const deviceType = req.deviceType || "web";
      const authClient = await GoogleAuthHelper.getAuthClientForUser(
        userEmail,
        deviceType
      );

      // Get spreadsheet ID - either from query or user's default
      let spreadsheetId = req.query.spreadsheet_id;
      if (!spreadsheetId) {
        spreadsheetId = await GoogleAuthHelper.getSpreadsheetIdForUser(
          userEmail
        );
      }

      if (!spreadsheetId) {
        res.status(400).json({
          success: false,
          error:
            "No spreadsheet ID provided and no default spreadsheet configured",
        });
        return;
      }

      // Get transaction using TransactionsHelper
      const transaction = await TransactionsHelper.getMovement(
        authClient,
        spreadsheetId,
        transactionId
      );

      if (!transaction) {
        res.status(404).json({
          success: false,
          error: "Transaction not found",
        });
        return;
      }

      res.json({ success: true, data: transaction });
    } catch (error) {
      console.error("Error fetching transaction:", error);
      res.status(500).json({
        error: "Failed to fetch transaction",
        details: error.message,
      });
    }
  }
}
