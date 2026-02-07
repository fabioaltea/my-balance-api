import { Request, Response } from "express";
import { AggregationsHelper } from "../helpers/mybalance/aggregations.helper";
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

export class AggregationsController {
  /**
   * GET /aggregations/monthly - Returns pre-calculated monthly aggregations
   */
  public static async getMonthlyAggregations(
    req: any,
    res: Response,
  ): Promise<void> {
    try {
      console.log("📊 =============");
      console.log("📊 GET /aggregations/monthly endpoint hit!");
      console.log("📊 User ID:", req.userId);
      console.log("📊 Query params:", req.query);
      console.log("📊 =============");

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

      console.log(
        "📊 Loading monthly aggregations for spreadsheet:",
        spreadsheetId,
      );

      // Parse optional date filters
      const from_date = req.query.from_date;
      const to_date = req.query.to_date;

      // Get monthly aggregations
      const aggregations = await GoogleAuthHelper.executeWithRetry(
        userEmail,
        deviceType,
        async (client) =>
          AggregationsHelper.getMonthlyAggregations(
            client,
            spreadsheetId,
            from_date,
            to_date,
          ),
      );

      console.log(
        "📊 Monthly aggregations loaded successfully:",
        Object.keys(aggregations).length,
        "months",
      );

      res.json({ success: true, data: aggregations });
    } catch (error: any) {
      if (handleGoogleTokenError(error, res, "getMonthlyAggregations")) return;
      console.error("❌ Error fetching monthly aggregations:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch monthly aggregations",
        details: error?.message,
      });
    }
  }
}
