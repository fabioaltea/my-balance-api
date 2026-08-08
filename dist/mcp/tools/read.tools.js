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
exports.registerReadTools = registerReadTools;
const mybalance_1 = require("../../helpers/mybalance");
const context_1 = require("../context");
const errors_1 = require("../errors");
const schemas_1 = require("../schemas");
const readOnlyAnnotations = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
};
function executeReadTool(name, operation) {
    return __awaiter(this, void 0, void 0, function* () {
        const startedAt = Date.now();
        try {
            const data = yield operation();
            const structuredContent = { data };
            console.info(`[MCP] ${name} completed in ${Date.now() - startedAt}ms`);
            return {
                content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
                structuredContent,
            };
        }
        catch (error) {
            console.warn(`[MCP] ${name} failed after ${Date.now() - startedAt}ms`);
            return (0, errors_1.toMcpErrorResult)(error);
        }
    });
}
function registerReadTools(server, principal) {
    server.registerTool('list_accounts', {
        title: 'List accounts',
        description: "List the authenticated user's accounts from their default spreadsheet.",
        inputSchema: schemas_1.listAccountsInputSchema,
        outputSchema: schemas_1.dataOutputSchema,
        annotations: readOnlyAnnotations,
    }, (_a) => __awaiter(this, [_a], void 0, function* ({ calculateBalance }) {
        return executeReadTool('list_accounts', () => (0, context_1.withDefaultSpreadsheet)(principal, (authClient, spreadsheetId) => mybalance_1.AccountsHelper.getAccounts(spreadsheetId, authClient, calculateBalance)));
    }));
    server.registerTool('list_categories', {
        title: 'List categories',
        description: "List the authenticated user's categories from their default spreadsheet.",
        inputSchema: schemas_1.emptyInputSchema,
        outputSchema: schemas_1.dataOutputSchema,
        annotations: readOnlyAnnotations,
    }, () => __awaiter(this, void 0, void 0, function* () {
        return executeReadTool('list_categories', () => (0, context_1.withDefaultSpreadsheet)(principal, (authClient, spreadsheetId) => mybalance_1.CategoriesHelper.getCategories(spreadsheetId, authClient)));
    }));
    server.registerTool('get_category', {
        title: 'Get category',
        description: "Get one category by its exact name from the authenticated user's spreadsheet.",
        inputSchema: schemas_1.getCategoryInputSchema,
        outputSchema: schemas_1.dataOutputSchema,
        annotations: readOnlyAnnotations,
    }, (_a) => __awaiter(this, [_a], void 0, function* ({ categoryName }) {
        return executeReadTool('get_category', () => (0, context_1.withDefaultSpreadsheet)(principal, (authClient, spreadsheetId) => __awaiter(this, void 0, void 0, function* () {
            const categories = yield mybalance_1.CategoriesHelper.getCategories(spreadsheetId, authClient);
            const category = categories.find((item) => item.name === categoryName);
            if (!category)
                throw (0, errors_1.resourceNotFound)('Category');
            return category;
        })));
    }));
    server.registerTool('list_movements', {
        title: 'List movements',
        description: "List all logical movements and their transactions from the authenticated user's spreadsheet.",
        inputSchema: schemas_1.emptyInputSchema,
        outputSchema: schemas_1.dataOutputSchema,
        annotations: readOnlyAnnotations,
    }, () => __awaiter(this, void 0, void 0, function* () {
        return executeReadTool('list_movements', () => (0, context_1.withDefaultSpreadsheet)(principal, (authClient, spreadsheetId) => mybalance_1.TransactionsHelper.listMovements(authClient, spreadsheetId)));
    }));
    server.registerTool('get_movement', {
        title: 'Get movement',
        description: "Get one logical movement by ID from the authenticated user's spreadsheet.",
        inputSchema: schemas_1.getMovementInputSchema,
        outputSchema: schemas_1.dataOutputSchema,
        annotations: readOnlyAnnotations,
    }, (_a) => __awaiter(this, [_a], void 0, function* ({ movementId }) {
        return executeReadTool('get_movement', () => (0, context_1.withDefaultSpreadsheet)(principal, (authClient, spreadsheetId) => __awaiter(this, void 0, void 0, function* () {
            const movement = yield mybalance_1.TransactionsHelper.getMovement(authClient, spreadsheetId, movementId);
            if (!movement)
                throw (0, errors_1.resourceNotFound)('Movement');
            return movement;
        })));
    }));
    server.registerTool('list_transactions', {
        title: 'List transactions',
        description: "List the authenticated user's transactions with optional filters and pagination. Dates use dd-MM-yyyy.",
        inputSchema: schemas_1.listTransactionsInputSchema,
        outputSchema: schemas_1.dataOutputSchema,
        annotations: readOnlyAnnotations,
    }, (_a) => __awaiter(this, [_a], void 0, function* ({ fromDate, toDate, account, category, type, status, limit, offset }) {
        const filters = {
            from_date: fromDate,
            to_date: toDate,
            account,
            category,
            type,
            status,
            limit,
            offset,
        };
        return executeReadTool('list_transactions', () => (0, context_1.withDefaultSpreadsheet)(principal, (authClient, spreadsheetId) => mybalance_1.TransactionsHelper.listTransactions(authClient, spreadsheetId, filters)));
    }));
    server.registerTool('list_transactions_delta', {
        title: 'List changed transactions',
        description: "List transactions changed since an ISO timestamp from the authenticated user's spreadsheet.",
        inputSchema: schemas_1.listTransactionsDeltaInputSchema,
        outputSchema: schemas_1.dataOutputSchema,
        annotations: readOnlyAnnotations,
    }, (_a) => __awaiter(this, [_a], void 0, function* ({ since }) {
        return executeReadTool('list_transactions_delta', () => (0, context_1.withDefaultSpreadsheet)(principal, (authClient, spreadsheetId) => mybalance_1.TransactionsHelper.listTransactionsDelta(authClient, spreadsheetId, since)));
    }));
    server.registerTool('get_monthly_aggregations', {
        title: 'Get monthly aggregations',
        description: 'Get monthly income, expense and balance aggregations. Optional dates use dd-MM-yyyy.',
        inputSchema: schemas_1.monthlyAggregationsInputSchema,
        outputSchema: schemas_1.dataOutputSchema,
        annotations: readOnlyAnnotations,
    }, (_a) => __awaiter(this, [_a], void 0, function* ({ fromDate, toDate }) {
        return executeReadTool('get_monthly_aggregations', () => (0, context_1.withDefaultSpreadsheet)(principal, (authClient, spreadsheetId) => mybalance_1.AggregationsHelper.getMonthlyAggregations(authClient, spreadsheetId, fromDate, toDate)));
    }));
}
//# sourceMappingURL=read.tools.js.map