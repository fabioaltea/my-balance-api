import { Request, Response } from "express";
import { CategoriesHelper } from "../helpers/mybalance";
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

export class CategoriesController {
  /**
   * GET /categories - Recupera tutte le categorie
   */
  public static async getCategories(req: any, res: Response): Promise<void> {
    try {
      console.log("🔄 GET /categories endpoint hit!");
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

      // Get all categories using CategoriesHelper
      const categories = await CategoriesHelper.getCategories(
        spreadsheetId,
        authClient
      );

      res.json({ success: true, data: categories });
    } catch (error: any) {
      if (handleGoogleTokenError(error, res, "getCategories")) return;
      console.error("Error fetching categories:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch categories",
        details: error?.message,
      });
    }
  }

  /**
   * GET /categories/:categoryId - Recupera singola categoria
   */
  public static async getCategory(req: any, res: Response): Promise<void> {
    try {
      const userEmail = req.userId;
      const { categoryId } = req.params;

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

      // Get categories and find the one with matching ID
      const categories = await CategoriesHelper.getCategories(
        spreadsheetId,
        authClient
      );

      const category = categories.find((c) => c.name === categoryId);

      if (!category) {
        res.status(404).json({
          success: false,
          error: "Category not found",
        });
        return;
      }

      res.json({ success: true, data: category });
    } catch (error: any) {
      if (handleGoogleTokenError(error, res, "getCategory")) return;
      console.error("Error fetching category:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch category",
        details: error?.message,
      });
    }
  }

  /**
   * POST /categories - Crea nuova categoria
   */
  public static async createCategory(req: any, res: Response): Promise<void> {
    try {
      const userEmail = req.userId;
      const categoryData = req.body;

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

      // Create category using CategoriesHelper
      const result = await CategoriesHelper.createCategory(
        spreadsheetId,
        categoryData,
        authClient
      );

      res.json({ success: true, data: result });
    } catch (error: any) {
      if (handleGoogleTokenError(error, res, "createCategory")) return;
      console.error("Error creating category:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create category",
        details: error?.message,
      });
    }
  }

  /**
   * PUT /categories/:categoryId - Aggiorna categoria esistente
   */
  public static async updateCategory(req: any, res: Response): Promise<void> {
    try {
      const userEmail = req.userId;
      const { categoryId } = req.params;
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

      // Update category using CategoriesHelper
      const updatedCategory = await CategoriesHelper.updateCategory(
        spreadsheetId,
        categoryId,
        updateData,
        authClient
      );

      res.json({ success: true, data: updatedCategory });
    } catch (error: any) {
      if (handleGoogleTokenError(error, res, "updateCategory")) return;
      console.error("Error updating category:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update category",
        details: error?.message,
      });
    }
  }

  /**
   * DELETE /categories/:categoryId - Elimina categoria
   */
  public static async deleteCategory(req: any, res: Response): Promise<void> {
    try {
      const userEmail = req.userId;
      const { categoryId } = req.params;

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

      // Delete category using CategoriesHelper
      await CategoriesHelper.deleteCategory(
        spreadsheetId,
        categoryId,
        authClient
      );

      res.json({ success: true, message: "Category deleted successfully" });
    } catch (error: any) {
      if (handleGoogleTokenError(error, res, "deleteCategory")) return;
      console.error("Error deleting category:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete category",
        details: error?.message,
      });
    }
  }

  /**
   * POST /categories/batch - Crea categorie in batch
   */
  public static async createCategoriesBatch(
    req: any,
    res: Response
  ): Promise<void> {
    try {
      const userEmail = req.userId;
      const { categories } = req.body;

      if (!categories || !Array.isArray(categories)) {
        res.status(400).json({
          success: false,
          error: "Missing or invalid categories array",
        });
        return;
      }

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

      // Create categories in batch using CategoriesHelper
      const result = await CategoriesHelper.createCategoriesBatch(
        spreadsheetId,
        categories,
        authClient
      );

      res.json({ success: true, data: result });
    } catch (error: any) {
      if (handleGoogleTokenError(error, res, "createCategoriesBatch")) return;
      console.error("Error creating categories batch:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create categories batch",
        details: error?.message,
      });
    }
  }
}
