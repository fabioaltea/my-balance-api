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
exports.MigrationHelper = exports.LATEST_SCHEMA_VERSION = void 0;
const google_1 = require("../google");
const auth_helper_1 = require("../google/auth.helper");
const db_helper_1 = require("../db.helper");
exports.LATEST_SCHEMA_VERSION = 3;
/**
 * Mapping colonne v1 → v2 per AllTransactions.
 *
 * v1: desc(0) cat(1) amt(2) date(3) type(4) account(5) txId(6) mvId(7) notes(8) location(9) recId(10) dateAdded(11) dateMod(12) dateDel(13) status(14)
 * v2: desc(0) cat(1) amt(2) date(3) type(4) account(5) status(6) location(7) notes(8) txId(9) mvId(10) recId(11) recPattern(12) dateAdded(13) dateMod(14) dateDel(15)
 */
const V1_TO_V2_COL_MAP = {
    0: 0, // description → description
    1: 1, // category → category
    2: 2, // amount → amount
    3: 3, // date → date
    4: 4, // type → type
    5: 5, // account → account
    6: 9, // transactionId → transactionId (spostato)
    7: 10, // movementId → movementId (spostato)
    8: 8, // notes → notes
    9: 7, // location → location (spostato)
    10: 11, // recurrenceId → recurrenceId (spostato)
    11: 13, // dateAdded → dateAdded (spostato)
    12: 14, // dateModified → dateModified (spostato)
    13: 15, // dateDeleted → dateDeleted (spostato)
    14: 6, // status → status (spostato)
};
const V2_COL_COUNT = 16; // incluso recurrencePattern
const V2_HEADERS = [
    "description", "category", "amount", "date", "type", "account",
    "status", "location", "notes", "transactionId", "movementId",
    "recurrenceId", "recurrencePattern", "dateAdded", "dateModified", "dateDeleted",
];
const SHEET_NAME = "AllTransactions";
const OLD_SHEET_NAME = "AllTransactions_old";
/**
 * Trova lo sheetId numerico di un tab dal suo nome
 */
function getSheetId(userEmail, deviceType, spreadsheetId, sheetName) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const sheetsMeta = yield auth_helper_1.GoogleAuthHelper.executeWithRetry(userEmail, deviceType, (client) => __awaiter(this, void 0, void 0, function* () { return google_1.GoogleHelper.getSpreadsheetMeta(client, spreadsheetId); }));
        const match = sheetsMeta.find((s) => { var _a; return ((_a = s.properties) === null || _a === void 0 ? void 0 : _a.title) === sheetName; });
        return (_b = (_a = match === null || match === void 0 ? void 0 : match.properties) === null || _a === void 0 ? void 0 : _a.sheetId) !== null && _b !== void 0 ? _b : null;
    });
}
/**
 * Migrazione v1 → v2: riordino colonne AllTransactions
 *
 * Approccio sicuro:
 *  1. Se esiste già AllTransactions_old (tentativo precedente fallito), lo usa come sorgente
 *  2. Rinomina AllTransactions → AllTransactions_old
 *  3. Crea un nuovo tab AllTransactions
 *  4. Scrive header v2 + dati mappati nel nuovo tab
 *  (il tab _old rimane per sicurezza, lo si potrà eliminare manualmente)
 */
const migrationV1toV2 = {
    fromVersion: 1,
    toVersion: 2,
    description: "Riordino colonne AllTransactions + aggiunta recurrencePattern",
    execute: (spreadsheetId, userEmail, deviceType) => __awaiter(void 0, void 0, void 0, function* () {
        console.log("🔄 Executing migration v1 → v2 (rename+copy)");
        // --- Retry-safe: controlla se esiste già _old da un tentativo precedente ---
        const oldSheetId = yield getSheetId(userEmail, deviceType, spreadsheetId, OLD_SHEET_NAME);
        const currentSheetId = yield getSheetId(userEmail, deviceType, spreadsheetId, SHEET_NAME);
        let sourceSheetName;
        if (oldSheetId !== null && currentSheetId !== null) {
            // Entrambi esistono: il tentativo precedente ha già rinominato e creato il nuovo,
            // ma potrebbe non aver finito di copiare. Usiamo _old come sorgente
            // e cancelliamo il nuovo vuoto per ricrearlo
            console.log("⚠️ Found existing AllTransactions_old — resuming previous attempt");
            yield auth_helper_1.GoogleAuthHelper.executeWithRetry(userEmail, deviceType, (client) => __awaiter(void 0, void 0, void 0, function* () {
                return google_1.GoogleHelper.batchUpdateSpreadsheet(client, spreadsheetId, [
                    { deleteSheet: { sheetId: currentSheetId } },
                ]);
            }));
            sourceSheetName = OLD_SHEET_NAME;
        }
        else if (oldSheetId !== null && currentSheetId === null) {
            // Solo _old esiste (caso raro): usalo come sorgente
            console.log("⚠️ Only AllTransactions_old found — resuming");
            sourceSheetName = OLD_SHEET_NAME;
        }
        else if (currentSheetId === null) {
            throw new Error("AllTransactions sheet not found in spreadsheet");
        }
        else {
            // Caso normale: rinomina AllTransactions → AllTransactions_old
            console.log("🔄 Renaming AllTransactions → AllTransactions_old");
            yield auth_helper_1.GoogleAuthHelper.executeWithRetry(userEmail, deviceType, (client) => __awaiter(void 0, void 0, void 0, function* () {
                return google_1.GoogleHelper.batchUpdateSpreadsheet(client, spreadsheetId, [
                    {
                        updateSheetProperties: {
                            properties: { sheetId: currentSheetId, title: OLD_SHEET_NAME },
                            fields: "title",
                        },
                    },
                ]);
            }));
            sourceSheetName = OLD_SHEET_NAME;
        }
        // --- Crea nuovo tab AllTransactions ---
        console.log("🔄 Creating new AllTransactions sheet");
        yield auth_helper_1.GoogleAuthHelper.executeWithRetry(userEmail, deviceType, (client) => __awaiter(void 0, void 0, void 0, function* () {
            return google_1.GoogleHelper.batchUpdateSpreadsheet(client, spreadsheetId, [
                {
                    addSheet: {
                        properties: { title: SHEET_NAME, index: 0 },
                    },
                },
            ]);
        }));
        // --- Leggi dati dal vecchio tab ---
        let rows;
        try {
            rows = yield auth_helper_1.GoogleAuthHelper.executeWithRetry(userEmail, deviceType, (client) => __awaiter(void 0, void 0, void 0, function* () { return google_1.GoogleHelper.get(client, spreadsheetId, `${sourceSheetName}!A1:Z`); }));
        }
        catch (_a) {
            console.log("⚠️ Source sheet vuoto o non accessibile, skip dati");
            rows = undefined;
        }
        // --- Scrivi header v2 ---
        yield auth_helper_1.GoogleAuthHelper.executeWithRetry(userEmail, deviceType, (client) => __awaiter(void 0, void 0, void 0, function* () {
            return google_1.GoogleHelper.update(client, spreadsheetId, [
                { range: `${SHEET_NAME}!A1:P1`, values: [V2_HEADERS] },
            ]);
        }));
        // --- Mappa e scrivi dati ---
        if (rows && rows.length > 0) {
            // Salta la prima riga se è un header
            const firstCell = String(rows[0][0] || "").toLowerCase();
            const dataRows = firstCell === "description" ? rows.slice(1) : rows;
            if (dataRows.length > 0) {
                const migratedRows = dataRows.map((row) => {
                    var _a;
                    const newRow = new Array(V2_COL_COUNT).fill("");
                    for (const [v1Idx, v2Idx] of Object.entries(V1_TO_V2_COL_MAP)) {
                        const sourceIdx = parseInt(v1Idx);
                        if (sourceIdx < row.length) {
                            newRow[v2Idx] = (_a = row[sourceIdx]) !== null && _a !== void 0 ? _a : "";
                        }
                    }
                    return newRow;
                });
                // Scrivi dalla riga 2 (dopo gli header) usando update (non append)
                yield auth_helper_1.GoogleAuthHelper.executeWithRetry(userEmail, deviceType, (client) => __awaiter(void 0, void 0, void 0, function* () {
                    return google_1.GoogleHelper.update(client, spreadsheetId, [
                        {
                            range: `${SHEET_NAME}!A2:P${migratedRows.length + 1}`,
                            values: migratedRows,
                        },
                    ]);
                }));
                console.log(`✅ Migrated ${migratedRows.length} data rows to new AllTransactions`);
            }
            else {
                console.log("ℹ️ No data rows to migrate (only header)");
            }
        }
        else {
            console.log("ℹ️ No data to migrate");
        }
        console.log("✅ Migration v1 → v2 completed (AllTransactions_old preserved)");
    }),
};
/**
 * Helper generico per migrare un singolo sheet con rename+copy.
 * 1. Rinomina sheetName → sheetName_old (retry-safe)
 * 2. Crea nuovo sheetName
 * 3. Scrive headers
 * 4. Legge dati da _old, applica colMap, scrive nel nuovo
 */
function migrateSheet(spreadsheetId, userEmail, deviceType, sheetName, newHeaders, colMap, newColCount, headerDetectCell) {
    return __awaiter(this, void 0, void 0, function* () {
        const oldName = `${sheetName}_old`;
        const oldSheetId = yield getSheetId(userEmail, deviceType, spreadsheetId, oldName);
        const currentSheetId = yield getSheetId(userEmail, deviceType, spreadsheetId, sheetName);
        let sourceSheetName;
        if (oldSheetId !== null && currentSheetId !== null) {
            console.log(`⚠️ Found existing ${oldName} — resuming previous attempt`);
            yield auth_helper_1.GoogleAuthHelper.executeWithRetry(userEmail, deviceType, (client) => __awaiter(this, void 0, void 0, function* () {
                return google_1.GoogleHelper.batchUpdateSpreadsheet(client, spreadsheetId, [
                    { deleteSheet: { sheetId: currentSheetId } },
                ]);
            }));
            sourceSheetName = oldName;
        }
        else if (oldSheetId !== null && currentSheetId === null) {
            console.log(`⚠️ Only ${oldName} found — resuming`);
            sourceSheetName = oldName;
        }
        else if (currentSheetId === null) {
            throw new Error(`${sheetName} sheet not found in spreadsheet`);
        }
        else {
            console.log(`🔄 Renaming ${sheetName} → ${oldName}`);
            yield auth_helper_1.GoogleAuthHelper.executeWithRetry(userEmail, deviceType, (client) => __awaiter(this, void 0, void 0, function* () {
                return google_1.GoogleHelper.batchUpdateSpreadsheet(client, spreadsheetId, [
                    {
                        updateSheetProperties: {
                            properties: { sheetId: currentSheetId, title: oldName },
                            fields: "title",
                        },
                    },
                ]);
            }));
            sourceSheetName = oldName;
        }
        console.log(`🔄 Creating new ${sheetName} sheet`);
        yield auth_helper_1.GoogleAuthHelper.executeWithRetry(userEmail, deviceType, (client) => __awaiter(this, void 0, void 0, function* () {
            return google_1.GoogleHelper.batchUpdateSpreadsheet(client, spreadsheetId, [
                { addSheet: { properties: { title: sheetName } } },
            ]);
        }));
        const lastCol = String.fromCharCode(64 + newHeaders.length); // A=65, so 6 cols → F
        yield auth_helper_1.GoogleAuthHelper.executeWithRetry(userEmail, deviceType, (client) => __awaiter(this, void 0, void 0, function* () {
            return google_1.GoogleHelper.update(client, spreadsheetId, [
                { range: `${sheetName}!A1:${lastCol}1`, values: [newHeaders] },
            ]);
        }));
        let rows;
        try {
            rows = yield auth_helper_1.GoogleAuthHelper.executeWithRetry(userEmail, deviceType, (client) => __awaiter(this, void 0, void 0, function* () { return google_1.GoogleHelper.get(client, spreadsheetId, `${sourceSheetName}!A1:Z`); }));
        }
        catch (_a) {
            console.log(`⚠️ ${sourceSheetName} vuoto o non accessibile, skip dati`);
            rows = undefined;
        }
        if (rows && rows.length > 0) {
            const detect = headerDetectCell || String(newHeaders[0]).toLowerCase();
            const firstCell = String(rows[0][0] || "").toLowerCase();
            const dataRows = firstCell === detect ? rows.slice(1) : rows;
            if (dataRows.length > 0) {
                const migratedRows = dataRows.map((row) => {
                    var _a;
                    const newRow = new Array(newColCount).fill("");
                    for (const [srcIdx, dstIdx] of Object.entries(colMap)) {
                        const s = parseInt(srcIdx);
                        if (s < row.length) {
                            newRow[dstIdx] = (_a = row[s]) !== null && _a !== void 0 ? _a : "";
                        }
                    }
                    return newRow;
                });
                yield auth_helper_1.GoogleAuthHelper.executeWithRetry(userEmail, deviceType, (client) => __awaiter(this, void 0, void 0, function* () {
                    return google_1.GoogleHelper.update(client, spreadsheetId, [
                        {
                            range: `${sheetName}!A2:${lastCol}${migratedRows.length + 1}`,
                            values: migratedRows,
                        },
                    ]);
                }));
                console.log(`✅ Migrated ${migratedRows.length} data rows to new ${sheetName}`);
            }
        }
    });
}
// =====================
// Migrazione v2 → v3
// =====================
/**
 * Accounts v2→v3:
 * v2: accountName(0) startBalance(1) curBalance(2) color(3) txtColor(4) imgUrl(5) isTotal(6)
 * v3: accountName(0) accountColor(1) accountTxtColor(2) accountImgUrl(3) dateAdded(4) dateModified(5)
 */
const ACCOUNTS_V2_TO_V3_COL_MAP = {
    0: 0, // accountName → accountName
    3: 1, // accountColor → accountColor
    4: 2, // accountTxtColor → accountTxtColor
    5: 3, // accountImgUrl → accountImgUrl
    // startBalance(1), curBalance(2), isTotal(6) → removed
    // dateAdded(4), dateModified(5) → new, default ""
};
const ACCOUNTS_V3_HEADERS = [
    "accountName", "accountColor", "accountTxtColor", "accountImgUrl", "dateAdded", "dateModified",
];
const ACCOUNTS_V3_COL_COUNT = 6;
/**
 * Categories v2→v3:
 * v2: categoryName(0) categoryType(1) categoryColor(2) categoryIconUrl(3)
 * v3: categoryName(0) categoryColor(1) categoryIconUrl(2) dateAdded(3) dateModified(4)
 */
const CATEGORIES_V2_TO_V3_COL_MAP = {
    0: 0, // categoryName → categoryName
    // 1: categoryType → removed
    2: 1, // categoryColor → categoryColor
    3: 2, // categoryIconUrl → categoryIconUrl
    // dateAdded(3), dateModified(4) → new, default ""
};
const CATEGORIES_V3_HEADERS = [
    "categoryName", "categoryColor", "categoryIconUrl", "dateAdded", "dateModified",
];
const CATEGORIES_V3_COL_COUNT = 5;
const migrationV2toV3 = {
    fromVersion: 2,
    toVersion: 3,
    description: "Accounts: rimozione balance/isTotal + dateAdded/dateModified. Categories: rimozione type + dateAdded/dateModified",
    execute: (spreadsheetId, userEmail, deviceType) => __awaiter(void 0, void 0, void 0, function* () {
        console.log("🔄 Executing migration v2 → v3 (rename+copy)");
        // Migra Accounts
        yield migrateSheet(spreadsheetId, userEmail, deviceType, "Accounts", ACCOUNTS_V3_HEADERS, ACCOUNTS_V2_TO_V3_COL_MAP, ACCOUNTS_V3_COL_COUNT, "accountname");
        // Migra Categories
        yield migrateSheet(spreadsheetId, userEmail, deviceType, "Categories", CATEGORIES_V3_HEADERS, CATEGORIES_V2_TO_V3_COL_MAP, CATEGORIES_V3_COL_COUNT, "categoryname");
        console.log("✅ Migration v2 → v3 completed");
    }),
};
/**
 * Registry delle migrazioni disponibili, ordinate per versione
 */
const MIGRATIONS = [migrationV1toV2, migrationV2toV3];
/**
 * Helper per la gestione delle migrazioni di schema
 */
class MigrationHelper {
    /**
     * Esegue tutte le migrazioni pendenti per un utente
     * @returns La nuova schema_version dopo le migrazioni
     */
    static executePendingMigrations(userEmail, deviceType) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            // Leggi user_products per schema_version e spreadsheet_id
            const userProduct = yield db_helper_1.DbHelper.getUserProduct(userEmail);
            const currentVersion = (_a = userProduct === null || userProduct === void 0 ? void 0 : userProduct.schema_version) !== null && _a !== void 0 ? _a : 1;
            if (currentVersion >= exports.LATEST_SCHEMA_VERSION) {
                console.log(`✅ Schema already at v${currentVersion}, no migration needed`);
                return {
                    fromVersion: currentVersion,
                    toVersion: currentVersion,
                    migrationsRun: 0,
                };
            }
            const spreadsheetId = userProduct === null || userProduct === void 0 ? void 0 : userProduct.spreadsheet_id;
            if (!spreadsheetId) {
                throw new Error("No spreadsheet configured for user in user_products");
            }
            console.log(`🔄 Migrating schema v${currentVersion} → v${exports.LATEST_SCHEMA_VERSION} for ${userEmail}`);
            // Esegui le migrazioni in ordine
            let version = currentVersion;
            let migrationsRun = 0;
            for (const migration of MIGRATIONS) {
                if (migration.fromVersion === version) {
                    console.log(`🔄 Running migration: ${migration.description} (v${migration.fromVersion} → v${migration.toVersion})`);
                    yield migration.execute(spreadsheetId, userEmail, deviceType);
                    version = migration.toVersion;
                    migrationsRun++;
                    // Aggiorna la versione nel DB dopo ogni migrazione
                    yield db_helper_1.DbHelper.updateSchemaVersion(userEmail, version);
                    console.log(`✅ Schema version updated to v${version}`);
                }
            }
            return {
                fromVersion: currentVersion,
                toVersion: version,
                migrationsRun,
            };
        });
    }
}
exports.MigrationHelper = MigrationHelper;
//# sourceMappingURL=migration.helper.js.map