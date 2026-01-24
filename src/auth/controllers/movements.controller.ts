import { Request, Response } from "express";
import { TransactionsHelper } from "../../helpers/MyBalance/TransactionsHelper";
import { GoogleAuthHelper } from "../../helpers/GoogleAuthHelper";

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

      // Get all movements using TransactionsHelper
      const movements = await TransactionsHelper.listMovements(
        authClient,
        spreadsheetId
      );

      res.json({ success: true, data: movements });
    } catch (error: any) {
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

      // Get movement using TransactionsHelper
      const movement = await TransactionsHelper.getMovement(
        authClient,
        spreadsheetId,
        movementId
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

      // Create movement using TransactionsHelper
      const result = await TransactionsHelper.appendMovement(
        authClient,
        spreadsheetId,
        movementData
      );

      res.json({ success: true, data: result });
    } catch (error: any) {
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

      // Update movement using TransactionsHelper
      // Ensure movementId from URL is included in the request
      const movementRequest = {
        ...updateData,
        movementId: movementId,
      };
      const updatedMovement = await TransactionsHelper.updateMovement(
        authClient,
        spreadsheetId,
        movementRequest
      );

      res.json({ success: true, data: updatedMovement });
    } catch (error: any) {
      console.error("Error updating movement:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update movement",
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

      // Delete movement using TransactionsHelper
      await TransactionsHelper.deleteMovement(
        authClient,
        spreadsheetId,
        movementId
      );

      res.json({ success: true, message: "Movement deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting movement:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete movement",
        details: error?.message,
      });
    }
  }
}
