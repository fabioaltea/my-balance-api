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
exports.MovementsController = void 0;
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
class MovementsController {
    /**
     * GET /movements - Recupera tutti i movements
     */
    static getMovements(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log("🔄 GET /movements endpoint hit!");
                const userEmail = req.userId;
                // Get user's Google auth client
                const deviceType = req.deviceType || "web";
                const authClient = yield google_1.GoogleAuthHelper.getAuthClientForUser(userEmail, deviceType);
                // Get spreadsheet ID - either from query or user's default
                let spreadsheetId = req.query.spreadsheet_id;
                if (!spreadsheetId) {
                    spreadsheetId = yield google_1.GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
                }
                if (!spreadsheetId) {
                    res.status(400).json({
                        success: false,
                        error: "Missing spreadsheet_id in query params and no default spreadsheet configured",
                    });
                    return;
                }
                // Get all movements using TransactionsHelper
                const movements = yield mybalance_1.TransactionsHelper.listMovements(authClient, spreadsheetId);
                res.json({ success: true, data: movements });
            }
            catch (error) {
                if (handleGoogleTokenError(error, res, "getMovements"))
                    return;
                console.error("Error fetching movements:", error);
                res.status(500).json({
                    success: false,
                    error: "Failed to fetch movements",
                    details: error === null || error === void 0 ? void 0 : error.message,
                });
            }
        });
    }
    /**
     * GET /movements/:movementId - Recupera singolo movement
     */
    static getMovement(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userEmail = req.userId;
                const { movementId } = req.params;
                // Get user's Google auth client
                const deviceType = req.deviceType || "web";
                const authClient = yield google_1.GoogleAuthHelper.getAuthClientForUser(userEmail, deviceType);
                // Get spreadsheet ID - either from query or user's default
                let spreadsheetId = req.query.spreadsheet_id;
                if (!spreadsheetId) {
                    spreadsheetId = yield google_1.GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
                }
                if (!spreadsheetId) {
                    res.status(400).json({
                        success: false,
                        error: "Missing spreadsheet_id in query params and no default spreadsheet configured",
                    });
                    return;
                }
                // Get movement using TransactionsHelper
                const movement = yield mybalance_1.TransactionsHelper.getMovement(authClient, spreadsheetId, movementId);
                if (!movement) {
                    res.status(404).json({
                        success: false,
                        error: "Movement not found",
                    });
                    return;
                }
                res.json({ success: true, data: movement });
            }
            catch (error) {
                if (handleGoogleTokenError(error, res, "getMovement"))
                    return;
                console.error("Error fetching movement:", error);
                res.status(500).json({
                    success: false,
                    error: "Failed to fetch movement",
                    details: error === null || error === void 0 ? void 0 : error.message,
                });
            }
        });
    }
    /**
     * POST /movements - Crea nuovo movement
     */
    static createMovement(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userEmail = req.userId;
                const movementData = req.body;
                // Get user's Google auth client
                const deviceType = req.deviceType || "web";
                const authClient = yield google_1.GoogleAuthHelper.getAuthClientForUser(userEmail, deviceType);
                // Get spreadsheet ID - either from query or user's default
                let spreadsheetId = req.query.spreadsheet_id;
                if (!spreadsheetId) {
                    spreadsheetId = yield google_1.GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
                }
                if (!spreadsheetId) {
                    res.status(400).json({
                        success: false,
                        error: "Missing spreadsheet_id in query params and no default spreadsheet configured",
                    });
                    return;
                }
                // Create movement using TransactionsHelper
                const result = yield mybalance_1.TransactionsHelper.appendMovement(authClient, spreadsheetId, movementData);
                res.json({ success: true, data: result });
            }
            catch (error) {
                if (handleGoogleTokenError(error, res, "createMovement"))
                    return;
                console.error("Error creating movement:", error);
                res.status(500).json({
                    success: false,
                    error: "Failed to create movement",
                    details: error === null || error === void 0 ? void 0 : error.message,
                });
            }
        });
    }
    /**
     * PUT /movements/:movementId - Aggiorna movement esistente
     */
    static updateMovement(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userEmail = req.userId;
                const { movementId } = req.params;
                const updateData = req.body;
                // Get user's Google auth client
                const deviceType = req.deviceType || "web";
                const authClient = yield google_1.GoogleAuthHelper.getAuthClientForUser(userEmail, deviceType);
                // Get spreadsheet ID - either from query or user's default
                let spreadsheetId = req.query.spreadsheet_id;
                if (!spreadsheetId) {
                    spreadsheetId = yield google_1.GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
                }
                if (!spreadsheetId) {
                    res.status(400).json({
                        success: false,
                        error: "Missing spreadsheet_id in query params and no default spreadsheet configured",
                    });
                    return;
                }
                // Update movement using TransactionsHelper
                // Ensure movementId from URL is included in the request
                const movementRequest = Object.assign(Object.assign({}, updateData), { movementId: movementId });
                const updatedMovement = yield mybalance_1.TransactionsHelper.updateMovement(authClient, spreadsheetId, movementRequest);
                res.json({ success: true, data: updatedMovement });
            }
            catch (error) {
                if (handleGoogleTokenError(error, res, "updateMovement"))
                    return;
                console.error("Error updating movement:", error);
                res.status(500).json({
                    success: false,
                    error: "Failed to update movement",
                    details: error === null || error === void 0 ? void 0 : error.message,
                });
            }
        });
    }
    /**
     * DELETE /movements/:movementId - Elimina movement
     */
    static deleteMovement(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userEmail = req.userId;
                const { movementId } = req.params;
                // Get user's Google auth client
                const deviceType = req.deviceType || "web";
                const authClient = yield google_1.GoogleAuthHelper.getAuthClientForUser(userEmail, deviceType);
                // Get spreadsheet ID - either from query or user's default
                let spreadsheetId = req.query.spreadsheet_id;
                if (!spreadsheetId) {
                    spreadsheetId = yield google_1.GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
                }
                if (!spreadsheetId) {
                    res.status(400).json({
                        success: false,
                        error: "Missing spreadsheet_id in query params and no default spreadsheet configured",
                    });
                    return;
                }
                // Delete movement using TransactionsHelper
                yield mybalance_1.TransactionsHelper.deleteMovement(authClient, spreadsheetId, movementId);
                res.json({ success: true, message: "Movement deleted successfully" });
            }
            catch (error) {
                if (handleGoogleTokenError(error, res, "deleteMovement"))
                    return;
                console.error("Error deleting movement:", error);
                res.status(500).json({
                    success: false,
                    error: "Failed to delete movement",
                    details: error === null || error === void 0 ? void 0 : error.message,
                });
            }
        });
    }
}
exports.MovementsController = MovementsController;
//# sourceMappingURL=movements.controller.js.map