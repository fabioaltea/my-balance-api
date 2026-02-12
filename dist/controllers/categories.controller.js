"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoriesController = void 0;
const mybalance_1 = require("../helpers/mybalance");
const google_1 = require("../helpers/google");
// Helper to handle Google token errors and return appropriate HTTP status
function handleGoogleTokenError(error, res, context) {
    if (error instanceof google_1.GoogleTokenError) {
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
class CategoriesController {
    /**
     * GET /categories - Recupera tutte le categorie
     */
    static getCategories(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log("🔄 GET /categories endpoint hit!");
                const userEmail = req.userId;
                // Get user's Google auth client
                const deviceType = req.deviceType || "web";
                // Get spreadsheet ID - either from query or user's default
                let spreadsheetId = req.query.spreadsheet_id;
                if (!spreadsheetId) {
                    spreadsheetId =
                        yield google_1.GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
                }
                if (!spreadsheetId) {
                    res.status(400).json({
                        success: false,
                        error: "Missing spreadsheet_id in query params and no default spreadsheet configured",
                    });
                    return;
                }
                // Get all categories using CategoriesHelper
                const categories = yield google_1.GoogleAuthHelper.executeWithRetry(userEmail, deviceType, (client) => __awaiter(this, void 0, void 0, function* () { return mybalance_1.CategoriesHelper.getCategories(spreadsheetId, client); }));
                res.json({ success: true, data: categories });
            }
            catch (error) {
                if (handleGoogleTokenError(error, res, "getCategories"))
                    return;
                console.error("Error fetching categories:", error);
                res.status(500).json({
                    success: false,
                    error: "Failed to fetch categories",
                    details: error === null || error === void 0 ? void 0 : error.message,
                });
            }
        });
    }
    /**
     * GET /categories/:categoryId - Recupera singola categoria
     */
    static getCategory(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userEmail = req.userId;
                const { categoryId } = req.params;
                // Get user's Google auth client
                const deviceType = req.deviceType || "web";
                // Get spreadsheet ID - either from query or user's default
                let spreadsheetId = req.query.spreadsheet_id;
                if (!spreadsheetId) {
                    spreadsheetId =
                        yield google_1.GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
                }
                if (!spreadsheetId) {
                    res.status(400).json({
                        success: false,
                        error: "Missing spreadsheet_id in query params and no default spreadsheet configured",
                    });
                    return;
                }
                // Get categories and find the one with matching ID
                const categories = yield google_1.GoogleAuthHelper.executeWithRetry(userEmail, deviceType, (client) => __awaiter(this, void 0, void 0, function* () { return mybalance_1.CategoriesHelper.getCategories(spreadsheetId, client); }));
                const category = categories.find((c) => c.name === categoryId);
                if (!category) {
                    res.status(404).json({
                        success: false,
                        error: "Category not found",
                    });
                    return;
                }
                res.json({ success: true, data: category });
            }
            catch (error) {
                if (handleGoogleTokenError(error, res, "getCategory"))
                    return;
                console.error("Error fetching category:", error);
                res.status(500).json({
                    success: false,
                    error: "Failed to fetch category",
                    details: error === null || error === void 0 ? void 0 : error.message,
                });
            }
        });
    }
    /**
     * POST /categories - Crea nuova categoria
     */
    static createCategory(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userEmail = req.userId;
                const categoryData = req.body;
                // Get user's Google auth client
                const deviceType = req.deviceType || "web";
                // Get spreadsheet ID - either from query or user's default
                let spreadsheetId = req.query.spreadsheet_id;
                if (!spreadsheetId) {
                    spreadsheetId =
                        yield google_1.GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
                }
                if (!spreadsheetId) {
                    res.status(400).json({
                        success: false,
                        error: "Missing spreadsheet_id in query params and no default spreadsheet configured",
                    });
                    return;
                }
                // Create category using CategoriesHelper
                const result = yield google_1.GoogleAuthHelper.executeWithRetry(userEmail, deviceType, (client) => __awaiter(this, void 0, void 0, function* () { return mybalance_1.CategoriesHelper.createCategory(spreadsheetId, categoryData, client); }));
                res.json({ success: true, data: result });
            }
            catch (error) {
                if (handleGoogleTokenError(error, res, "createCategory"))
                    return;
                console.error("Error creating category:", error);
                res.status(500).json({
                    success: false,
                    error: "Failed to create category",
                    details: error === null || error === void 0 ? void 0 : error.message,
                });
            }
        });
    }
    /**
     * PUT /categories/:categoryId - Aggiorna categoria esistente
     */
    static updateCategory(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userEmail = req.userId;
                const { categoryId } = req.params;
                const updateData = req.body;
                // Get user's Google auth client
                const deviceType = req.deviceType || "web";
                // Get spreadsheet ID - either from query or user's default
                let spreadsheetId = req.query.spreadsheet_id;
                if (!spreadsheetId) {
                    spreadsheetId =
                        yield google_1.GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
                }
                if (!spreadsheetId) {
                    res.status(400).json({
                        success: false,
                        error: "Missing spreadsheet_id in query params and no default spreadsheet configured",
                    });
                    return;
                }
                // Update category using CategoriesHelper
                const updatedCategory = yield google_1.GoogleAuthHelper.executeWithRetry(userEmail, deviceType, (client) => __awaiter(this, void 0, void 0, function* () {
                    return mybalance_1.CategoriesHelper.updateCategory(spreadsheetId, categoryId, updateData, client);
                }));
                res.json({ success: true, data: updatedCategory });
            }
            catch (error) {
                if (handleGoogleTokenError(error, res, "updateCategory"))
                    return;
                console.error("Error updating category:", error);
                res.status(500).json({
                    success: false,
                    error: "Failed to update category",
                    details: error === null || error === void 0 ? void 0 : error.message,
                });
            }
        });
    }
    /**
     * DELETE /categories/:categoryId - Elimina categoria
     */
    static deleteCategory(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userEmail = req.userId;
                const { categoryId } = req.params;
                // Get user's Google auth client
                const deviceType = req.deviceType || "web";
                // Get spreadsheet ID - either from query or user's default
                let spreadsheetId = req.query.spreadsheet_id;
                if (!spreadsheetId) {
                    spreadsheetId =
                        yield google_1.GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
                }
                if (!spreadsheetId) {
                    res.status(400).json({
                        success: false,
                        error: "Missing spreadsheet_id in query params and no default spreadsheet configured",
                    });
                    return;
                }
                // Delete category using CategoriesHelper
                yield google_1.GoogleAuthHelper.executeWithRetry(userEmail, deviceType, (client) => __awaiter(this, void 0, void 0, function* () { return mybalance_1.CategoriesHelper.deleteCategory(spreadsheetId, categoryId, client); }));
                res.json({ success: true, message: "Category deleted successfully" });
            }
            catch (error) {
                if (handleGoogleTokenError(error, res, "deleteCategory"))
                    return;
                console.error("Error deleting category:", error);
                res.status(500).json({
                    success: false,
                    error: "Failed to delete category",
                    details: error === null || error === void 0 ? void 0 : error.message,
                });
            }
        });
    }
    /**
     * GET /categories/default - Recupera categorie default del sistema (pubblico)
     */
    // public static async getDefaultCategories(
    //   req: any,
    //   res: Response,
    // ): Promise<void> {
    //   try {
    //     const defaultCategories = CategoriesHelper.getDefaultCategories();
    //     res.json({ success: true, data: defaultCategories });
    //   } catch (error: any) {
    //     console.error("Error fetching default categories:", error);
    //     res.status(500).json({
    //       success: false,
    //       error: "Failed to fetch default categories",
    //       details: error?.message,
    //     });
    //   }
    // }
    /**
     * POST /categories/batch - Crea categorie in batch
     */
    static createCategoriesBatch(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
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
                // Get spreadsheet ID - either from query or user's default
                let spreadsheetId = req.query.spreadsheet_id;
                if (!spreadsheetId) {
                    spreadsheetId =
                        yield google_1.GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
                }
                if (!spreadsheetId) {
                    res.status(400).json({
                        success: false,
                        error: "Missing spreadsheet_id in query params and no default spreadsheet configured",
                    });
                    return;
                }
                // Create categories in batch using CategoriesHelper
                const result = yield google_1.GoogleAuthHelper.executeWithRetry(userEmail, deviceType, (client) => __awaiter(this, void 0, void 0, function* () {
                    return mybalance_1.CategoriesHelper.createCategoriesBatch(spreadsheetId, categories, client);
                }));
                res.json({ success: true, data: result });
            }
            catch (error) {
                if (handleGoogleTokenError(error, res, "createCategoriesBatch"))
                    return;
                console.error("Error creating categories batch:", error);
                res.status(500).json({
                    success: false,
                    error: "Failed to create categories batch",
                    details: error === null || error === void 0 ? void 0 : error.message,
                });
            }
        });
    }
}
exports.CategoriesController = CategoriesController;
//# sourceMappingURL=categories.controller.js.map