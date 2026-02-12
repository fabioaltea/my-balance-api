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
exports.SpreadsheetsHelper = void 0;
const google_1 = require("../google");
const auth_helper_1 = require("../google/auth.helper");
const db_helper_1 = require("../db.helper");
const migration_helper_1 = require("./migration.helper");
class SpreadsheetsHelper {
    /**
     * Crea nuovo spreadsheet usando le Google Sheets API
     */
    static createSpreadsheet(userEmail, title, deviceType) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log("Creating spreadsheet", title, "for", userEmail);
                const res = yield auth_helper_1.GoogleAuthHelper.executeWithRetry(userEmail, deviceType, (client) => __awaiter(this, void 0, void 0, function* () { return google_1.GoogleHelper.create(client, userEmail); }));
                const spreadsheetId = res.data.spreadsheetId;
                if (!spreadsheetId) {
                    throw new Error("No spreadsheet ID returned from Google API");
                }
                // Salva lo spreadsheetId nel DB (tabella users legacy)
                yield auth_helper_1.GoogleAuthHelper.setSpreadsheetIdForUser(userEmail, spreadsheetId);
                // Upsert user_products con schema version corrente
                yield db_helper_1.DbHelper.upsertUserProduct(userEmail, spreadsheetId, migration_helper_1.LATEST_SCHEMA_VERSION);
                console.log("Spreadsheet created:", spreadsheetId);
                return spreadsheetId;
            }
            catch (error) {
                console.error("Error creating spreadsheet:", error);
                throw error;
            }
        });
    }
    /**
     * Inizializza spreadsheet con headers
     */
    static initializeSpreadsheet(spreadsheetId, userEmail, deviceType) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log("Initializing spreadsheet", spreadsheetId);
                // Header rows allineati ai COLS usati dai rispettivi helper
                const headerData = [
                    {
                        range: "AllTransactions!A1:P1",
                        values: [[
                                "description", "category", "amount", "date", "type", "account",
                                "status", "location", "notes", "transactionId", "movementId",
                                "recurrenceId", "recurrencePattern", "dateAdded", "dateModified", "dateDeleted"
                            ]],
                    },
                    {
                        range: "Accounts!A1:F1",
                        values: [[
                                "accountName", "accountColor", "accountTxtColor",
                                "accountImgUrl", "dateAdded", "dateModified"
                            ]],
                    },
                    {
                        range: "Categories!A1:E1",
                        values: [[
                                "categoryName", "categoryColor", "categoryIconUrl",
                                "dateAdded", "dateModified"
                            ]],
                    },
                ];
                yield auth_helper_1.GoogleAuthHelper.executeWithRetry(userEmail, deviceType, (client) => __awaiter(this, void 0, void 0, function* () { return google_1.GoogleHelper.update(client, spreadsheetId, headerData); }));
                console.log("Spreadsheet initialized with headers");
            }
            catch (error) {
                console.error("Error initializing spreadsheet:", error);
                throw error;
            }
        });
    }
    /**
     * Valida struttura spreadsheet esistente
     */
    static validateSpreadsheetStructure(spreadsheetId, userEmail, deviceType) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log("Validating spreadsheet structure", spreadsheetId);
                const issues = [];
                const requiredSheets = ["AllTransactions", "Accounts", "Categories"];
                for (const sheetName of requiredSheets) {
                    try {
                        yield auth_helper_1.GoogleAuthHelper.executeWithRetry(userEmail, deviceType, (client) => __awaiter(this, void 0, void 0, function* () { return google_1.GoogleHelper.get(client, spreadsheetId, `${sheetName}!A1:A1`); }));
                    }
                    catch (_a) {
                        issues.push(`Missing sheet: ${sheetName}`);
                    }
                }
                return {
                    valid: issues.length === 0,
                    issues,
                };
            }
            catch (error) {
                console.error("Error validating spreadsheet structure:", error);
                throw error;
            }
        });
    }
    /**
     * Ottieni dati template per nuovo setup
     */
    static getTemplateData() {
        return {
            sheets: [
                {
                    name: "AllTransactions",
                    headers: [
                        "description",
                        "category",
                        "amount",
                        "date",
                        "type",
                        "account",
                        "status",
                        "location",
                        "notes",
                        "transactionId",
                        "movementId",
                        "recurrenceId",
                        "recurrencePattern",
                        "dateAdded",
                        "dateModified",
                        "dateDeleted",
                    ],
                },
                {
                    name: "Accounts",
                    headers: [
                        "accountName",
                        "accountColor",
                        "accountTxtColor",
                        "accountImgUrl",
                        "dateAdded",
                        "dateModified",
                    ],
                },
                {
                    name: "Categories",
                    headers: [
                        "categoryName",
                        "categoryColor",
                        "categoryIconUrl",
                        "dateAdded",
                        "dateModified",
                    ],
                },
            ],
            defaultCategories: [
                {
                    name: "Alimentari",
                    description: "Spesa per cibo e bevande",
                    color: "#4CAF50",
                    icon: "restaurant",
                },
                {
                    name: "Trasporti",
                    description: "Auto, benzina, mezzi pubblici",
                    color: "#2196F3",
                    icon: "car",
                },
                {
                    name: "Casa",
                    description: "Affitto, bollette, spese domestiche",
                    color: "#FF9800",
                    icon: "home",
                },
                {
                    name: "Salute",
                    description: "Visite mediche, farmaci",
                    color: "#F44336",
                    icon: "medical",
                },
                {
                    name: "Svago",
                    description: "Divertimento, hobby, viaggi",
                    color: "#9C27B0",
                    icon: "game",
                },
                {
                    name: "Lavoro",
                    description: "Stipendio, bonus, rimborsi",
                    color: "#607D8B",
                    icon: "briefcase",
                },
                {
                    name: "Investimenti",
                    description: "Azioni, fondi, risparmi",
                    color: "#795548",
                    icon: "trending-up",
                },
                {
                    name: "Altro",
                    description: "Spese varie non categorizzate",
                    color: "#9E9E9E",
                    icon: "ellipsis",
                },
            ],
            defaultAccounts: [
                {
                    name: "Conto Corrente",
                    description: "Conto principale",
                    balance: "0,00",
                    color: "#2196F3",
                },
                {
                    name: "Contanti",
                    description: "Denaro liquido",
                    balance: "0,00",
                    color: "#4CAF50",
                },
                {
                    name: "Carta di Credito",
                    description: "Carta di credito principale",
                    balance: "0,00",
                    color: "#FF5722",
                },
            ],
        };
    }
}
exports.SpreadsheetsHelper = SpreadsheetsHelper;
//# sourceMappingURL=spreadsheets.helper.js.map