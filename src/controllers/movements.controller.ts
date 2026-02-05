import { Request, Response } from "express";
import { TransactionsHelper } from "../helpers/mybalance";
import { GoogleAuthHelper, GoogleTokenError } from "../helpers/google";

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

      // Parse pagination parameters
      const pageParam = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
      const startDate = req.query.startDate as string; // Format: dd-MM-yyyy
      const endDate = req.query.endDate as string; // Format: dd-MM-yyyy
      const sort = (req.query.sort as string) || "desc"; // "asc" or "desc"

      // Validate pagination parameters
      if (isNaN(pageParam) || pageParam < 1) {
        res.status(400).json({
          success: false,
          error: "Invalid page parameter. Must be a positive integer.",
        });
        return;
      }

      if (isNaN(limitParam) || limitParam < 1) {
        res.status(400).json({
          success: false,
          error: "Invalid limit parameter. Must be a positive integer.",
        });
        return;
      }

      // Validate date format if provided
      const dateRegex = /^\d{2}-\d{2}-\d{4}$/;
      if (startDate && !dateRegex.test(startDate)) {
        res.status(400).json({
          success: false,
          error: "Invalid startDate format. Expected format: dd-MM-yyyy",
        });
        return;
      }

      if (endDate && !dateRegex.test(endDate)) {
        res.status(400).json({
          success: false,
          error: "Invalid endDate format. Expected format: dd-MM-yyyy",
        });
        return;
      }

      const page = pageParam;
      const limit = Math.min(limitParam, 500); // Max 500 per page

      // Get all movements using TransactionsHelper
      const allMovements = await TransactionsHelper.listMovements(
        authClient,
        spreadsheetId
      );

      // Apply date filtering if provided
      let filteredMovements = allMovements;
      if (startDate || endDate) {
        filteredMovements = allMovements.filter((m) => {
          const txTimestamp = TransactionsHelper.parseDateToTimestamp(m.date);
          const startTimestamp = startDate ? TransactionsHelper.parseDateToTimestamp(startDate) : 0;
          const endTimestamp = endDate ? TransactionsHelper.parseDateToTimestamp(endDate) : Number.MAX_SAFE_INTEGER;
          return txTimestamp >= startTimestamp && txTimestamp <= endTimestamp;
        });
      }

      // Sort movements by date
      filteredMovements.sort((a, b) => {
        const dateA = TransactionsHelper.parseDateToTimestamp(a.date);
        const dateB = TransactionsHelper.parseDateToTimestamp(b.date);
        return sort === "desc" ? dateB - dateA : dateA - dateB;
      });

      // Calculate pagination
      const total = filteredMovements.length;
      const totalPages = Math.ceil(total / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedMovements = filteredMovements.slice(startIndex, endIndex);

      console.log(
        `🔄 Movements loaded: ${paginatedMovements.length} of ${total} (page ${page}/${totalPages})`
      );

      res.json({
        success: true,
        data: paginatedMovements,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasMore: page < totalPages,
        },
      });
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
