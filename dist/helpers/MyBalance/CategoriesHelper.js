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
exports.CategoriesHelper = void 0;
const GoogleHelper_1 = require("../GoogleHelper");
const SHEET_NAME = "Categories";
const SHEET_RANGE = "Categories!A2:Z";
// Mappatura colonne del foglio "Categories" (0-based)
const COLS = {
    NAME: 0, // A: categoryName
    TYPE: 1, // B: categoryType (legacy, non più usato)
    COLOR: 2, // C: categoryColor
    ICON: 3, // D: categoryIcon
    BALANCE: 4, // E: categoryBalance (legacy, non più usato)
    DESCRIPTION: 5, // F: description (se presente)
    IS_DELETED: 6, // G: flag eliminazione (se presente)
};
class CategoriesHelper {
    /**
     * Recupera tutte le categorie dal sheet "Categories"
     */
    static getCategories(spreadsheetId, authClient) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const auth = authClient;
                const rows = yield GoogleHelper_1.GoogleHelper.get(auth, spreadsheetId, SHEET_RANGE);
                if (!rows || rows.length === 0)
                    return [];
                const categories = [];
                // Salta la prima riga se contiene headers
                const startIndex = rows[0] &&
                    (rows[0][COLS.NAME] === "categoryName" || rows[0][COLS.NAME] === "name")
                    ? 1
                    : 0;
                for (let i = startIndex; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row || row.length === 0)
                        continue;
                    const category = this.rowToCategory(row, i);
                    if (category &&
                        !category.name.startsWith("DELETED_") &&
                        category.status === "ACTIVE") {
                        categories.push(category);
                    }
                }
                return categories;
            }
            catch (error) {
                console.error("Error getting categories:", error);
                throw error;
            }
        });
    }
    /**
     * Crea nuova categoria
     */
    static createCategory(spreadsheetId, categoryData, authClient) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // TODO: Implementare chiamata diretta alle Google Sheets API
                console.log("Creating category in", spreadsheetId, categoryData);
                // Placeholder - da implementare
                return {
                    categoryId: this.generateId(),
                    name: categoryData.name,
                    description: categoryData.description || "",
                    color: categoryData.color || "#808080",
                    icon: categoryData.icon || "",
                    status: "ACTIVE",
                    dateAdded: this.formatDateTime(new Date()),
                };
            }
            catch (error) {
                console.error("Error creating category:", error);
                throw error;
            }
        });
    }
    /**
     * Aggiorna categoria esistente
     */
    static updateCategory(spreadsheetId, categoryId, updateData, authClient) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // TODO: Implementare chiamata diretta alle Google Sheets API
                console.log("Updating category", categoryId, "in", spreadsheetId, updateData);
                // Placeholder - da implementare
                return {
                    categoryId,
                    name: updateData.name || "",
                    description: updateData.description || "",
                    color: updateData.color || "#808080",
                    icon: updateData.icon || "",
                    status: "ACTIVE",
                };
            }
            catch (error) {
                console.error("Error updating category:", error);
                throw error;
            }
        });
    }
    /**
     * Elimina categoria (soft delete)
     */
    static deleteCategory(spreadsheetId, categoryId, authClient) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // TODO: Implementare chiamata diretta alle Google Sheets API
                console.log("Deleting category", categoryId, "from", spreadsheetId);
                // Placeholder - da implementare
            }
            catch (error) {
                console.error("Error deleting category:", error);
                throw error;
            }
        });
    }
    /**
     * Crea multiple categorie in batch
     */
    static createCategoriesBatch(spreadsheetId, categories, authClient) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // TODO: Implementare chiamata diretta alle Google Sheets API
                console.log("Creating categories batch in", spreadsheetId, categories);
                // Placeholder - da implementare
                return categories.map((category) => ({
                    categoryId: this.generateId(),
                    name: category.name,
                    description: category.description || "",
                    color: category.color || "#808080",
                    icon: category.icon || "",
                    status: "ACTIVE",
                    dateAdded: this.formatDateTime(new Date()),
                }));
            }
            catch (error) {
                console.error("Error creating categories batch:", error);
                throw error;
            }
        });
    }
    /**
     * Ottieni categorie default del sistema
     */
    static getDefaultCategories() {
        return [
            {
                categoryId: "default_1",
                name: "Alimentari",
                description: "Spesa per cibo e bevande",
                color: "#4CAF50",
                icon: "restaurant",
                status: "ACTIVE",
            },
            {
                categoryId: "default_2",
                name: "Trasporti",
                description: "Auto, benzina, mezzi pubblici",
                color: "#2196F3",
                icon: "car",
                status: "ACTIVE",
            },
            {
                categoryId: "default_3",
                name: "Casa",
                description: "Affitto, bollette, spese domestiche",
                color: "#FF9800",
                icon: "home",
                status: "ACTIVE",
            },
            {
                categoryId: "default_4",
                name: "Salute",
                description: "Visite mediche, farmaci",
                color: "#F44336",
                icon: "medical",
                status: "ACTIVE",
            },
            {
                categoryId: "default_5",
                name: "Svago",
                description: "Divertimento, hobby, viaggi",
                color: "#9C27B0",
                icon: "game",
                status: "ACTIVE",
            },
            {
                categoryId: "default_6",
                name: "Lavoro",
                description: "Stipendio, bonus, rimborsi",
                color: "#607D8B",
                icon: "briefcase",
                status: "ACTIVE",
            },
            {
                categoryId: "default_7",
                name: "Investimenti",
                description: "Azioni, fondi, risparmi",
                color: "#795548",
                icon: "trending-up",
                status: "ACTIVE",
            },
            {
                categoryId: "default_8",
                name: "Altro",
                description: "Spese varie non categorizzate",
                color: "#9E9E9E",
                icon: "ellipsis",
                status: "ACTIVE",
            },
        ];
    }
    // =================
    // UTILITY METHODS
    // =================
    /**
     * Converte una riga del foglio in un oggetto ICategory
     */
    static rowToCategory(row, rowIndex) {
        try {
            if (!row || row.length === 0)
                return null;
            const name = row[COLS.NAME] ? String(row[COLS.NAME]).trim() : "";
            if (!name || name === "categoryName" || name === "name")
                return null; // Skip header or empty
            return {
                categoryId: `cat_${rowIndex}_${name.replace(/\s+/g, "_")}`,
                name: name,
                description: row[COLS.DESCRIPTION]
                    ? String(row[COLS.DESCRIPTION]).trim()
                    : "",
                color: row[COLS.COLOR] || "#808080",
                icon: row[COLS.ICON] || "tag",
                status: row[COLS.IS_DELETED] === "1" ? "DELETED" : "ACTIVE",
                dateAdded: this.formatDateTime(new Date()), // Non abbiamo data nel sheet legacy
            };
        }
        catch (error) {
            console.error("Error parsing category row:", error);
            return null;
        }
    }
    static generateId() {
        return "cat_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    }
    static formatDateTime(date) {
        return `${date.getDate().toString().padStart(2, "0")}-${(date.getMonth() + 1)
            .toString()
            .padStart(2, "0")}-${date.getFullYear()} ${date
            .getHours()
            .toString()
            .padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
    }
}
exports.CategoriesHelper = CategoriesHelper;
//# sourceMappingURL=CategoriesHelper.js.map