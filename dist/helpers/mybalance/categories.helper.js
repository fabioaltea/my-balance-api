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
const google_1 = require("../google");
const SHEET_NAME = "Categories";
const SHEET_RANGE = "Categories!A2:Z";
// Mappatura colonne del foglio "Categories" (0-based) — Schema v3
const COLS = {
    NAME: 0, // A: categoryName
    COLOR: 1, // B: categoryColor
    ICON: 2, // C: categoryIcon
    DATE_ADDED: 3, // G: dateAdded
    DATE_MODIFIED: 4, // H: dateModified
};
class CategoriesHelper {
    /**
     * Recupera tutte le categorie dal sheet "Categories"
     */
    static getCategories(spreadsheetId, authClient) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const auth = authClient;
                const rows = yield google_1.GoogleHelper.get(auth, spreadsheetId, SHEET_RANGE);
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
                        !category.name.startsWith("DELETED_")) {
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
                const auth = authClient;
                const now = this.formatDateTime(new Date());
                // Prepara la riga seguendo il layout COLS (v3)
                const newRow = [
                    categoryData.name, // A: categoryName
                    categoryData.color || "#808080", // B: categoryColor
                    categoryData.icon || "", // C: categoryIcon
                    now, // D: dateAdded
                    now, // E: dateModified
                ];
                const body = {
                    majorDimension: "ROWS",
                    range: SHEET_RANGE,
                    values: [newRow],
                };
                yield google_1.GoogleHelper.append(auth, spreadsheetId, SHEET_RANGE, body);
                return {
                    name: categoryData.name,
                    color: categoryData.color || "#808080",
                    icon: categoryData.icon || "",
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
    static updateCategory(spreadsheetId, categoryName, updateData, authClient) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const auth = authClient;
                const rows = yield google_1.GoogleHelper.get(auth, spreadsheetId, SHEET_RANGE);
                if (!rows)
                    throw new Error("Sheet vuoto");
                let targetRowIndex = -1;
                let existingCategory = null;
                for (let i = 0; i < rows.length; i++) {
                    const category = this.rowToCategory(rows[i], i);
                    if (category && category.name === categoryName) {
                        targetRowIndex = i;
                        existingCategory = category;
                        break;
                    }
                }
                if (targetRowIndex === -1 || !existingCategory) {
                    throw new Error(`Categoria con nome ${categoryName} non trovata`);
                }
                const updatedRow = [...rows[targetRowIndex]];
                if (updateData.name)
                    updatedRow[COLS.NAME] = updateData.name;
                if (updateData.color)
                    updatedRow[COLS.COLOR] = updateData.color;
                if (updateData.icon)
                    updatedRow[COLS.ICON] = updateData.icon;
                const rowNumber = targetRowIndex + 2; // +2: skip header row + 1-based
                const updateRange = `${SHEET_NAME}!A${rowNumber}:Z${rowNumber}`;
                yield google_1.GoogleHelper.update(auth, spreadsheetId, [
                    { range: updateRange, values: [updatedRow] },
                ]);
                return Object.assign(Object.assign({}, existingCategory), { name: updateData.name || existingCategory.name, color: updateData.color || existingCategory.color, icon: updateData.icon || existingCategory.icon });
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
    static deleteCategory(spreadsheetId, categoryName, authClient) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const auth = authClient;
                const rows = yield google_1.GoogleHelper.get(auth, spreadsheetId, SHEET_RANGE);
                if (!rows)
                    throw new Error("Sheet vuoto");
                let targetRowIndex = -1;
                for (let i = 0; i < rows.length; i++) {
                    const category = this.rowToCategory(rows[i], i);
                    if (category && category.name === categoryName) {
                        targetRowIndex = i;
                        break;
                    }
                }
                if (targetRowIndex === -1) {
                    throw new Error(`Categoria con nome ${categoryName} non trovata`);
                }
                const updatedRow = [...rows[targetRowIndex]];
                const rowNumber = targetRowIndex + 2; // +2: skip header row + 1-based
                const updateRange = `${SHEET_NAME}!A${rowNumber}:Z${rowNumber}`;
                yield google_1.GoogleHelper.update(auth, spreadsheetId, [
                    { range: updateRange, values: [updatedRow] },
                ]);
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
                const auth = authClient;
                const now = this.formatDateTime(new Date());
                const newRows = [];
                const resultCategories = [];
                for (const categoryData of categories) {
                    newRows.push([
                        categoryData.name, // A: categoryName
                        categoryData.color || "#808080", // B: categoryColor
                        categoryData.icon || "", // C: categoryIcon
                        now, // D: dateAdded
                        now, // E: dateModified
                    ]);
                    resultCategories.push({
                        name: categoryData.name,
                        color: categoryData.color || "#808080",
                        icon: categoryData.icon || "",
                        dateAdded: now,
                    });
                }
                const body = {
                    majorDimension: "ROWS",
                    range: SHEET_RANGE,
                    values: newRows,
                };
                yield google_1.GoogleHelper.append(auth, spreadsheetId, SHEET_RANGE, body);
                return resultCategories;
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
    // static getDefaultCategories(): ICategory[] {
    //   return [
    //     {
    //       categoryId: "default_1",
    //       name: "Alimentari",
    //       description: "Spesa per cibo e bevande",
    //       color: "#4CAF50",
    //       icon: "restaurant",
    //       status: "ACTIVE",
    //     },
    //     {
    //       categoryId: "default_2",
    //       name: "Trasporti",
    //       description: "Auto, benzina, mezzi pubblici",
    //       color: "#2196F3",
    //       icon: "car",
    //       status: "ACTIVE",
    //     },
    //     {
    //       categoryId: "default_3",
    //       name: "Casa",
    //       description: "Affitto, bollette, spese domestiche",
    //       color: "#FF9800",
    //       icon: "home",
    //       status: "ACTIVE",
    //     },
    //     {
    //       categoryId: "default_4",
    //       name: "Salute",
    //       description: "Visite mediche, farmaci",
    //       color: "#F44336",
    //       icon: "medical",
    //       status: "ACTIVE",
    //     },
    //     {
    //       categoryId: "default_5",
    //       name: "Svago",
    //       description: "Divertimento, hobby, viaggi",
    //       color: "#9C27B0",
    //       icon: "game",
    //       status: "ACTIVE",
    //     },
    //     {
    //       categoryId: "default_6",
    //       name: "Lavoro",
    //       description: "Stipendio, bonus, rimborsi",
    //       color: "#607D8B",
    //       icon: "briefcase",
    //       status: "ACTIVE",
    //     },
    //     {
    //       categoryId: "default_7",
    //       name: "Investimenti",
    //       description: "Azioni, fondi, risparmi",
    //       color: "#795548",
    //       icon: "trending-up",
    //       status: "ACTIVE",
    //     },
    //     {
    //       categoryId: "default_8",
    //       name: "Altro",
    //       description: "Spese varie non categorizzate",
    //       color: "#9E9E9E",
    //       icon: "ellipsis",
    //       status: "ACTIVE",
    //     },
    //   ];
    // }
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
                name: name,
                color: row[COLS.COLOR] || "#808080",
                icon: row[COLS.ICON] || "tag",
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
//# sourceMappingURL=categories.helper.js.map