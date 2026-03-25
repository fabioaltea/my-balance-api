import { Request, Response } from "express";
import { TransactionsHelper } from "../helpers/mybalance";
import { GoogleAuthHelper, GoogleTokenError } from "../helpers/google";
import type { IMovementBatchUpdateRequest } from "../models/transactions.interfaces";

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

export class MovementsController {
  /**
   * GET /movements - Recupera tutti i movements
   */
  public static async getMovements(req: any, res: Response): Promise<void> {
    try {
      console.log("🔄 GET /movements endpoint hit!");
      const userEmail = req.userId;

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
            "Missing spreadsheet_id in query params and no default spreadsheet configured",
        });
        return;
      }

      // Get all movements using TransactionsHelper
      const movements = await GoogleAuthHelper.executeWithRetry(
        userEmail,
        deviceType,
        async (client) =>
          TransactionsHelper.listMovements(client, spreadsheetId),
      );

      res.json({ success: true, data: movements });
    } catch (error: any) {
      if (handleGoogleTokenError(error, res, "getMovements")) return;
      console.error("Error fetching movements:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch movements",
        details: error?.message,
      });
    }
  }

  /**
   * GET /movements/:movementId - Recupera singolo movement
   */
  public static async getMovement(req: any, res: Response): Promise<void> {
    try {
      const userEmail = req.userId;
      const { movementId } = req.params;

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
            "Missing spreadsheet_id in query params and no default spreadsheet configured",
        });
        return;
      }

      // Get movement using TransactionsHelper
      const movement = await GoogleAuthHelper.executeWithRetry(
        userEmail,
        deviceType,
        async (client) =>
          TransactionsHelper.getMovement(client, spreadsheetId, movementId),
      );

      if (!movement) {
        res.status(404).json({
          success: false,
          error: "Movement not found",
        });
        return;
      }

      res.json({ success: true, data: movement });
    } catch (error: any) {
      if (handleGoogleTokenError(error, res, "getMovement")) return;
      console.error("Error fetching movement:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch movement",
        details: error?.message,
      });
    }
  }

  /**
   * POST /movements - Crea nuovo movement
   */
  public static async createMovement(req: any, res: Response): Promise<void> {
    try {
      const userEmail = req.userId;
      const movementData = req.body;

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
            "Missing spreadsheet_id in query params and no default spreadsheet configured",
        });
        return;
      }

      // Create movement using TransactionsHelper
      const result = await GoogleAuthHelper.executeWithRetry(
        userEmail,
        deviceType,
        async (client) =>
          TransactionsHelper.appendMovement(
            client,
            spreadsheetId,
            movementData,
          ),
      );

      res.json({ success: true, data: result });
    } catch (error: any) {
      if (handleGoogleTokenError(error, res, "createMovement")) return;
      console.error("Error creating movement:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create movement",
        details: error?.message,
      });
    }
  }

  /**
   * PUT /movements/:movementId - Aggiorna movement esistente
   */
  public static async updateMovement(req: any, res: Response): Promise<void> {
    try {
      const userEmail = req.userId;
      const { movementId } = req.params;
      const updateData = req.body;

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
            "Missing spreadsheet_id in query params and no default spreadsheet configured",
        });
        return;
      }

      // Update movement using TransactionsHelper
      // Ensure movementId from URL is included in the request
      const movementRequest = {
        ...updateData,
        movementId: movementId,
      };
      const updatedMovement = await GoogleAuthHelper.executeWithRetry(
        userEmail,
        deviceType,
        async (client) =>
          TransactionsHelper.updateMovement(
            client,
            spreadsheetId,
            movementRequest,
          ),
      );

      res.json({ success: true, data: updatedMovement });
    } catch (error: any) {
      if (handleGoogleTokenError(error, res, "updateMovement")) return;
      console.error("Error updating movement:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update movement",
        details: error?.message,
      });
    }
  }

  /**
   * POST /movements/batch - Aggiorna multipli movements in batch
   */
  public static async updateMovementsBatch(
    req: any,
    res: Response,
  ): Promise<void> {
    try {
      const userEmail = req.userId;
      const deviceType = req.deviceType || "web";
      const { movements = [] } = req.body as IMovementBatchUpdateRequest;

      let spreadsheetId = req.query.spreadsheet_id;
      if (!spreadsheetId) {
        spreadsheetId =
          await GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
      }

      if (!spreadsheetId) {
        res.status(400).json({
          success: false,
          error:
            "Missing spreadsheet_id in query params and no default spreadsheet configured",
        });
        return;
      }

      if (!Array.isArray(movements) || movements.length === 0) {
        res.status(400).json({
          success: false,
          error: "movements must be a non-empty array",
        });
        return;
      }

      const result = await GoogleAuthHelper.executeWithRetry(
        userEmail,
        deviceType,
        async (client) =>
          TransactionsHelper.updateMovementsBatch(
            client,
            spreadsheetId,
            movements,
          ),
      );

      res.json({ success: true, data: result });
    } catch (error: any) {
      if (handleGoogleTokenError(error, res, "updateMovementsBatch")) return;
      console.error("Error updating movements batch:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update movements batch",
        details: error?.message,
      });
    }
  }

  /**
   * DELETE /movements/:movementId - Elimina movement
   */
  public static async deleteMovement(req: any, res: Response): Promise<void> {
    try {
      const userEmail = req.userId;
      const { movementId } = req.params;

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
            "Missing spreadsheet_id in query params and no default spreadsheet configured",
        });
        return;
      }

      // Delete movement using TransactionsHelper
      await GoogleAuthHelper.executeWithRetry(
        userEmail,
        deviceType,
        async (client) =>
          TransactionsHelper.deleteMovement(client, spreadsheetId, movementId),
      );

      res.json({ success: true, message: "Movement deleted successfully" });
    } catch (error: any) {
      if (handleGoogleTokenError(error, res, "deleteMovement")) return;
      console.error("Error deleting movement:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete movement",
        details: error?.message,
      });
    }
  }
}
