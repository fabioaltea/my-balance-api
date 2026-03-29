import { Request, Response } from 'express';
import { TransactionsHelper } from '../helpers/mybalance';
import { GoogleAuthHelper, GoogleTokenError } from '../helpers/google';

// Helper to handle Google token errors and return appropriate HTTP status
function handleGoogleTokenError(error: any, res: Response, context: string): boolean {
  if (error instanceof GoogleTokenError) {
    console.error(`❌ Google token error in ${context}:`, error.message, error.code);
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

export class TransactionsController {
  /**
   * GET /transactions - Restituisce tutte le transazioni (con supporto filtri)
   */
  public static async getTransactions(req: any, res: Response): Promise<void> {
    try {
      console.log('🔄 =============');
      console.log('🔄 GET /transactions endpoint hit!');
      console.log('🔄 User ID:', req.userId);
      console.log('🔄 Device Type:', req.deviceType);
      console.log('🔄 Query params:', req.query);
      console.log('🔄 =============');

      const userEmail = req.userId;
      const deviceType = req.deviceType || 'web';

      // Get spreadsheet ID - either from query or user's default
      let spreadsheetId = req.query.spreadsheet_id;
      if (!spreadsheetId) {
        spreadsheetId = await GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
      }

      if (!spreadsheetId) {
        res.status(400).json({
          success: false,
          error: 'Missing spreadsheet_id in query params and no default spreadsheet configured',
        });
        return;
      }

      console.log('🔄 Loading transactions for spreadsheet:', spreadsheetId);

      // Parse query filters (all optional for backward compatibility)
      const filters: any = {};

      if (req.query.from_date) filters.from_date = req.query.from_date;
      if (req.query.to_date) filters.to_date = req.query.to_date;
      if (req.query.account) filters.account = req.query.account;
      if (req.query.category) filters.category = req.query.category;
      if (req.query.type) filters.type = req.query.type;
      if (req.query.status) filters.status = req.query.status;

      // Validate numeric parameters
      if (req.query.limit) {
        const limit = parseInt(req.query.limit);
        if (isNaN(limit) || limit <= 0) {
          res.status(400).json({
            success: false,
            error: "Invalid 'limit' parameter. Must be a positive integer.",
          });
          return;
        }
        filters.limit = limit;
      }

      if (req.query.offset) {
        const offset = parseInt(req.query.offset);
        if (isNaN(offset) || offset < 0) {
          res.status(400).json({
            success: false,
            error: "Invalid 'offset' parameter. Must be a non-negative integer.",
          });
          return;
        }
        filters.offset = offset;
      }

      // Get transactions with automatic retry on auth errors
      const allTransactions = await GoogleAuthHelper.executeWithRetry(
        userEmail,
        deviceType,
        async (client) =>
          TransactionsHelper.listTransactions(
            client,
            spreadsheetId,
            Object.keys(filters).length > 0 ? filters : undefined,
          ),
      );

      console.log('🔄 Transactions loaded successfully:', allTransactions.length);

      res.json({ success: true, data: allTransactions });
    } catch (error: any) {
      if (handleGoogleTokenError(error, res, 'getTransactions')) return;
      console.error('❌ Error fetching transactions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch transactions',
        details: error?.message,
      });
    }
  }

  /**
   * POST /transactions - Crea nuova transazione
   */
  public static async createTransaction(req: any, res: Response): Promise<void> {
    try {
      const userEmail = req.userId;
      const transactionData = req.body;
      const deviceType = req.deviceType || 'web';

      // Get spreadsheet ID - either from query or user's default
      let spreadsheetId = req.query.spreadsheet_id;
      if (!spreadsheetId) {
        spreadsheetId = await GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
      }

      if (!spreadsheetId) {
        res.status(400).json({
          success: false,
          error: 'No spreadsheet ID provided and no default spreadsheet configured',
        });
        return;
      }

      // Create transaction with automatic retry on auth errors
      const result = await GoogleAuthHelper.executeWithRetry(
        userEmail,
        deviceType,
        async (client) => TransactionsHelper.appendMovement(client, spreadsheetId, transactionData),
      );

      res.json({ success: true, data: result });
    } catch (error: any) {
      if (handleGoogleTokenError(error, res, 'createTransaction')) return;
      console.error('Error creating transaction:', error);
      res.status(500).json({
        error: 'Failed to create transaction',
        details: error.message,
      });
    }
  }

  /**
   * PUT /transactions/:transactionId - Aggiorna transazione esistente
   */
  public static async updateTransaction(req: any, res: Response): Promise<void> {
    try {
      const userEmail = req.userId;
      const { transactionId } = req.params;
      const updateData = req.body;
      const deviceType = req.deviceType || 'web';

      // Get spreadsheet ID - either from query or user's default
      let spreadsheetId = req.query.spreadsheet_id;
      if (!spreadsheetId) {
        spreadsheetId = await GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
      }

      if (!spreadsheetId) {
        res.status(400).json({
          success: false,
          error: 'No spreadsheet ID provided and no default spreadsheet configured',
        });
        return;
      }

      // Update transaction with automatic retry on auth errors
      const updatedTransaction = await GoogleAuthHelper.executeWithRetry(
        userEmail,
        deviceType,
        async (client) => TransactionsHelper.updateMovement(client, spreadsheetId, updateData),
      );

      res.json({ success: true, data: updatedTransaction });
    } catch (error: any) {
      if (handleGoogleTokenError(error, res, 'updateTransaction')) return;
      console.error('Error updating transaction:', error);
      res.status(500).json({
        error: 'Failed to update transaction',
        details: error.message,
      });
    }
  }

  /**
   * DELETE /transactions/:transactionId - Elimina transazione
   */
  public static async deleteTransaction(req: any, res: Response): Promise<void> {
    try {
      const userEmail = req.userId;
      const { transactionId } = req.params;
      const deviceType = req.deviceType || 'web';

      // Get spreadsheet ID - either from query or user's default
      let spreadsheetId = req.query.spreadsheet_id;
      if (!spreadsheetId) {
        spreadsheetId = await GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
      }

      if (!spreadsheetId) {
        res.status(400).json({
          success: false,
          error: 'No spreadsheet ID provided and no default spreadsheet configured',
        });
        return;
      }

      // Delete transaction with automatic retry on auth errors
      await GoogleAuthHelper.executeWithRetry(userEmail, deviceType, async (client) =>
        TransactionsHelper.deleteMovement(client, spreadsheetId, transactionId),
      );

      res.json({ success: true, message: 'Transaction deleted successfully' });
    } catch (error: any) {
      if (handleGoogleTokenError(error, res, 'deleteTransaction')) return;
      console.error('Error deleting transaction:', error);
      res.status(500).json({
        error: 'Failed to delete transaction',
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
      const deviceType = req.deviceType || 'web';

      // Get spreadsheet ID - either from query or user's default
      let spreadsheetId = req.query.spreadsheet_id;
      if (!spreadsheetId) {
        spreadsheetId = await GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
      }

      if (!spreadsheetId) {
        res.status(400).json({
          success: false,
          error: 'No spreadsheet ID provided and no default spreadsheet configured',
        });
        return;
      }

      // Get transaction with automatic retry on auth errors
      const transaction = await GoogleAuthHelper.executeWithRetry(
        userEmail,
        deviceType,
        async (client) => TransactionsHelper.getMovement(client, spreadsheetId, transactionId),
      );

      if (!transaction) {
        res.status(404).json({
          success: false,
          error: 'Transaction not found',
        });
        return;
      }

      res.json({ success: true, data: transaction });
    } catch (error: any) {
      if (handleGoogleTokenError(error, res, 'getTransaction')) return;
      console.error('Error fetching transaction:', error);
      res.status(500).json({
        error: 'Failed to fetch transaction',
        details: error.message,
      });
    }
  }

  /**
   * GET /transactions/delta - Returns transactions modified since a timestamp
   */
  public static async getTransactionsDelta(req: any, res: Response): Promise<void> {
    try {
      const userEmail = req.userId;
      const { since } = req.query;

      if (!since) {
        res.status(400).json({
          success: false,
          error:
            "Missing 'since' parameter. Expected ISO timestamp format (e.g., 2024-12-01T10:30:00)",
        });
        return;
      }

      const deviceType = req.deviceType || 'web';

      // Get spreadsheet ID - either from query or user's default
      let spreadsheetId = req.query.spreadsheet_id;
      if (!spreadsheetId) {
        spreadsheetId = await GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
      }

      if (!spreadsheetId) {
        res.status(400).json({
          success: false,
          error: 'No spreadsheet ID provided and no default spreadsheet configured',
        });
        return;
      }

      console.log(`🔄 Loading transactions delta since: ${since}`);

      // Get transactions modified since timestamp with automatic retry on auth errors
      const deltaTransactions = await GoogleAuthHelper.executeWithRetry(
        userEmail,
        deviceType,
        async (client) => TransactionsHelper.listTransactionsDelta(client, spreadsheetId, since),
      );

      console.log(`🔄 Delta transactions loaded: ${deltaTransactions.length} items`);

      res.json({ success: true, data: deltaTransactions });
    } catch (error: any) {
      if (handleGoogleTokenError(error, res, 'getTransactionsDelta')) return;
      console.error('Error fetching transaction delta:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch transaction delta',
        details: error.message,
      });
    }
  }
}
