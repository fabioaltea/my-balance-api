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
                console.log('Creating spreadsheet', title, 'for', userEmail);
                const res = yield auth_helper_1.GoogleAuthHelper.executeWithRetry(userEmail, deviceType, (client) => __awaiter(this, void 0, void 0, function* () { return google_1.GoogleHelper.create(client, userEmail); }));
                const spreadsheetId = res.data.spreadsheetId;
                if (!spreadsheetId) {
                    throw new Error('No spreadsheet ID returned from Google API');
                }
                // Salva lo spreadsheetId nel DB (tabella users legacy)
                yield auth_helper_1.GoogleAuthHelper.setSpreadsheetIdForUser(userEmail, spreadsheetId);
                // Upsert user_products con schema version corrente
                yield db_helper_1.DbHelper.upsertUserProduct(userEmail, spreadsheetId, migration_helper_1.LATEST_SCHEMA_VERSION);
                console.log('Spreadsheet created:', spreadsheetId);
                return spreadsheetId;
            }
            catch (error) {
                console.error('Error creating spreadsheet:', error);
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
                console.log('Initializing spreadsheet', spreadsheetId);
                // Header rows allineati ai COLS usati dai rispettivi helper
                const headerData = [
                    {
                        range: 'AllTransactions!A1:P1',
                        values: [
                            [
                                'description',
                                'category',
                                'amount',
                                'date',
                                'type',
                                'account',
                                'status',
                                'location',
                                'notes',
                                'transactionId',
                                'movementId',
                                'recurrenceId',
                                'recurrencePattern',
                                'dateAdded',
                                'dateModified',
                                'dateDeleted',
                            ],
                        ],
                    },
                    {
                        range: 'Accounts!A1:F1',
                        values: [
                            [
                                'accountName',
                                'accountColor',
                                'accountTxtColor',
                                'accountImgUrl',
                                'dateAdded',
                                'dateModified',
                            ],
                        ],
                    },
                    {
                        range: 'Categories!A1:E1',
                        values: [
                            ['categoryName', 'categoryColor', 'categoryIconUrl', 'dateAdded', 'dateModified'],
                        ],
                    },
                ];
                // Contenuto sheet Instructions
                const now = new Date();
                const dateStr = `${now.getDate().toString().padStart(2, '0')}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
                const instructionsData = [
                    { range: 'Instructions!A1', values: [['MyBalance']] },
                    {
                        range: 'Instructions!A3',
                        values: [['MyBalance is your personal finance management app.']],
                    },
                    { range: 'Instructions!A5', values: [[`Schema Version: ${migration_helper_1.LATEST_SCHEMA_VERSION}`]] },
                    { range: 'Instructions!A6', values: [[`Last schema update: ${dateStr}`]] },
                    { range: 'Instructions!A7', values: [[`Last MyBalance update: ${dateStr}`]] },
                    { range: 'Instructions!A9', values: [['IMPORTANT']] },
                    {
                        range: 'Instructions!A10',
                        values: [['Do not manually edit the sheets: AllTransactions, Accounts, Categories.']],
                    },
                    {
                        range: 'Instructions!A11',
                        values: [['These sheets are automatically managed by the MyBalance app.']],
                    },
                    {
                        range: 'Instructions!A12',
                        values: [
                            ['You can create new sheets that reference data from these sheets without any issues.'],
                        ],
                    },
                ];
                // Scrivi headers + contenuto Instructions
                yield auth_helper_1.GoogleAuthHelper.executeWithRetry(userEmail, deviceType, (client) => __awaiter(this, void 0, void 0, function* () { return google_1.GoogleHelper.update(client, spreadsheetId, [...headerData, ...instructionsData]); }));
                // Sheet IDs dal template
                const SHEET_IDS = {
                    AllTransactions: 351667172,
                    Accounts: 1969697880,
                    Categories: 1969697881,
                    Instructions: 1969697882,
                };
                // Formattazione: headers, Instructions, conditional formatting
                const formatRequests = [
                    // --- Header rows: sfondo scuro + testo bianco bold ---
                    ...[SHEET_IDS.AllTransactions, SHEET_IDS.Accounts, SHEET_IDS.Categories].map((sheetId) => ({
                        repeatCell: {
                            range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
                            cell: {
                                userEnteredFormat: {
                                    backgroundColor: { red: 0.1, green: 0.1, blue: 0.18 },
                                    textFormat: {
                                        bold: true,
                                        foregroundColor: { red: 1, green: 1, blue: 1 },
                                    },
                                },
                            },
                            fields: 'userEnteredFormat(backgroundColor,textFormat)',
                        },
                    })),
                    // --- Instructions: titolo MyBalance (A1) grande e bold ---
                    {
                        repeatCell: {
                            range: {
                                sheetId: SHEET_IDS.Instructions,
                                startRowIndex: 0,
                                endRowIndex: 1,
                                startColumnIndex: 0,
                                endColumnIndex: 1,
                            },
                            cell: {
                                userEnteredFormat: {
                                    textFormat: {
                                        bold: true,
                                        fontSize: 18,
                                        foregroundColor: { red: 0.1, green: 0.1, blue: 0.18 },
                                    },
                                    backgroundColor: { red: 1, green: 0.95, blue: 0.8 },
                                },
                            },
                            fields: 'userEnteredFormat(textFormat,backgroundColor)',
                        },
                    },
                    // --- Instructions: "IMPORTANTE" (A9) sfondo giallo warning + bold ---
                    {
                        repeatCell: {
                            range: {
                                sheetId: SHEET_IDS.Instructions,
                                startRowIndex: 1,
                                endRowIndex: 9,
                                startColumnIndex: 0,
                                endColumnIndex: 5,
                            },
                            cell: {
                                userEnteredFormat: {
                                    backgroundColor: { red: 1, green: 0.95, blue: 0.8 },
                                    textFormat: { bold: true },
                                },
                            },
                            fields: 'userEnteredFormat(backgroundColor,textFormat)',
                        },
                    },
                    // --- Instructions: disclaimer rows (A10:A12) yellow warning background ---
                    {
                        repeatCell: {
                            range: {
                                sheetId: SHEET_IDS.Instructions,
                                startRowIndex: 9,
                                endRowIndex: 12,
                                startColumnIndex: 0,
                                endColumnIndex: 5,
                            },
                            cell: {
                                userEnteredFormat: {
                                    backgroundColor: { red: 1, green: 0.95, blue: 0.8 },
                                },
                            },
                            fields: 'userEnteredFormat(backgroundColor)',
                        },
                    },
                    // --- Conditional formatting: "in" → sfondo verde chiaro ---
                    {
                        addConditionalFormatRule: {
                            rule: {
                                ranges: [
                                    {
                                        sheetId: SHEET_IDS.AllTransactions,
                                        startRowIndex: 1,
                                        endRowIndex: 9999,
                                    },
                                ],
                                booleanRule: {
                                    condition: {
                                        type: 'CUSTOM_FORMULA',
                                        values: [{ userEnteredValue: '=$E2="in"' }],
                                    },
                                    format: {
                                        backgroundColor: { red: 0.83, green: 0.93, blue: 0.85 },
                                    },
                                },
                            },
                        },
                    },
                    // --- Conditional formatting: "out" → sfondo rosso chiaro ---
                    {
                        addConditionalFormatRule: {
                            rule: {
                                ranges: [
                                    {
                                        sheetId: SHEET_IDS.AllTransactions,
                                        startRowIndex: 1,
                                        endRowIndex: 9999,
                                    },
                                ],
                                booleanRule: {
                                    condition: {
                                        type: 'CUSTOM_FORMULA',
                                        values: [{ userEnteredValue: '=$E2="out"' }],
                                    },
                                    format: {
                                        backgroundColor: { red: 0.97, green: 0.84, blue: 0.85 },
                                    },
                                },
                            },
                        },
                    },
                ];
                yield auth_helper_1.GoogleAuthHelper.executeWithRetry(userEmail, deviceType, (client) => __awaiter(this, void 0, void 0, function* () { return google_1.GoogleHelper.batchUpdateSpreadsheet(client, spreadsheetId, formatRequests); }));
                console.log('Spreadsheet initialized with headers, instructions, and formatting');
            }
            catch (error) {
                console.error('Error initializing spreadsheet:', error);
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
                console.log('Validating spreadsheet structure', spreadsheetId);
                const issues = [];
                const requiredSheets = ['AllTransactions', 'Accounts', 'Categories'];
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
                console.error('Error validating spreadsheet structure:', error);
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
                    name: 'AllTransactions',
                    headers: [
                        'description',
                        'category',
                        'amount',
                        'date',
                        'type',
                        'account',
                        'status',
                        'location',
                        'notes',
                        'transactionId',
                        'movementId',
                        'recurrenceId',
                        'recurrencePattern',
                        'dateAdded',
                        'dateModified',
                        'dateDeleted',
                    ],
                },
                {
                    name: 'Accounts',
                    headers: [
                        'accountName',
                        'accountColor',
                        'accountTxtColor',
                        'accountImgUrl',
                        'dateAdded',
                        'dateModified',
                    ],
                },
                {
                    name: 'Categories',
                    headers: [
                        'categoryName',
                        'categoryColor',
                        'categoryIconUrl',
                        'dateAdded',
                        'dateModified',
                    ],
                },
            ],
            defaultCategories: [
                {
                    name: 'Alimentari',
                    description: 'Spesa per cibo e bevande',
                    color: '#4CAF50',
                    icon: 'restaurant',
                },
                {
                    name: 'Trasporti',
                    description: 'Auto, benzina, mezzi pubblici',
                    color: '#2196F3',
                    icon: 'car',
                },
                {
                    name: 'Casa',
                    description: 'Affitto, bollette, spese domestiche',
                    color: '#FF9800',
                    icon: 'home',
                },
                {
                    name: 'Salute',
                    description: 'Visite mediche, farmaci',
                    color: '#F44336',
                    icon: 'medical',
                },
                {
                    name: 'Svago',
                    description: 'Divertimento, hobby, viaggi',
                    color: '#9C27B0',
                    icon: 'game',
                },
                {
                    name: 'Lavoro',
                    description: 'Stipendio, bonus, rimborsi',
                    color: '#607D8B',
                    icon: 'briefcase',
                },
                {
                    name: 'Investimenti',
                    description: 'Azioni, fondi, risparmi',
                    color: '#795548',
                    icon: 'trending-up',
                },
                {
                    name: 'Altro',
                    description: 'Spese varie non categorizzate',
                    color: '#9E9E9E',
                    icon: 'ellipsis',
                },
            ],
            defaultAccounts: [
                {
                    name: 'Conto Corrente',
                    description: 'Conto principale',
                    balance: '0,00',
                    color: '#2196F3',
                },
                {
                    name: 'Contanti',
                    description: 'Denaro liquido',
                    balance: '0,00',
                    color: '#4CAF50',
                },
                {
                    name: 'Carta di Credito',
                    description: 'Carta di credito principale',
                    balance: '0,00',
                    color: '#FF5722',
                },
            ],
        };
    }
}
exports.SpreadsheetsHelper = SpreadsheetsHelper;
//# sourceMappingURL=spreadsheets.helper.js.map