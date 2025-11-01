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
class SpreadsheetsHelper {
    /**
     * Crea nuovo spreadsheet vuoto
     */
    static createSpreadsheet(refreshToken, title, userEmail) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // TODO: Implementare chiamata diretta alle Google Sheets API
                console.log("Creating spreadsheet", title, "for", userEmail);
                // Placeholder - da implementare con chiamate dirette alle API
                return "new_spreadsheet_id_" + Date.now();
            }
            catch (error) {
                console.error("Error creating spreadsheet:", error);
                throw error;
            }
        });
    }
    /**
     * Inizializza spreadsheet con headers e struttura
     */
    static initializeSpreadsheet(spreadsheetId, refreshToken) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // TODO: Implementare chiamata diretta alle Google Sheets API
                console.log("Initializing spreadsheet", spreadsheetId);
                // Placeholder - da implementare:
                // 1. Creare sheet AllTransactions, Accounts, Categories
                // 2. Aggiungere headers
                // 3. Impostare formattazione
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
    static validateSpreadsheetStructure(spreadsheetId, refreshToken) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // TODO: Implementare chiamata diretta alle Google Sheets API
                console.log("Validating spreadsheet structure", spreadsheetId);
                const issues = [];
                // Placeholder - da implementare:
                // 1. Controllare esistenza sheet principali
                // 2. Verificare headers
                // 3. Validare struttura colonne
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
                        "transactionId",
                        "movementId",
                        "notes",
                        "location",
                        "recurrenceId",
                        "dateAdded",
                        "dateModified",
                        "dateDeleted",
                        "status",
                    ],
                },
                {
                    name: "Accounts",
                    headers: [
                        "name",
                        "description",
                        "balance",
                        "color",
                        "textColor",
                        "status",
                        "dateAdded",
                        "dateDeleted",
                    ],
                },
                {
                    name: "Categories",
                    headers: [
                        "name",
                        "description",
                        "color",
                        "icon",
                        "status",
                        "dateAdded",
                        "dateDeleted",
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
//# sourceMappingURL=SpreadsheetsHelper.js.map