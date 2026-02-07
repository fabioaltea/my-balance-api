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
exports.AggregationsController = void 0;
const aggregations_helper_1 = require("../helpers/mybalance/aggregations.helper");
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
class AggregationsController {
    /**
     * GET /aggregations/monthly - Returns pre-calculated monthly aggregations
     */
    static getMonthlyAggregations(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log("📊 =============");
                console.log("📊 GET /aggregations/monthly endpoint hit!");
                console.log("📊 User ID:", req.userId);
                console.log("📊 Query params:", req.query);
                console.log("📊 =============");
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
                console.log("📊 Loading monthly aggregations for spreadsheet:", spreadsheetId);
                // Parse optional date filters
                const from_date = req.query.from_date;
                const to_date = req.query.to_date;
                // Get monthly aggregations
                const aggregations = yield aggregations_helper_1.AggregationsHelper.getMonthlyAggregations(authClient, spreadsheetId, from_date, to_date);
                console.log("📊 Monthly aggregations loaded successfully:", Object.keys(aggregations).length, "months");
                res.json({ success: true, data: aggregations });
            }
            catch (error) {
                if (handleGoogleTokenError(error, res, "getMonthlyAggregations"))
                    return;
                console.error("❌ Error fetching monthly aggregations:", error);
                res.status(500).json({
                    success: false,
                    error: "Failed to fetch monthly aggregations",
                    details: error === null || error === void 0 ? void 0 : error.message,
                });
            }
        });
    }
}
exports.AggregationsController = AggregationsController;
//# sourceMappingURL=aggregations.controller.js.map