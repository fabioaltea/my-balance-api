import type { McpServer } from '@modelcontextprotocol/server';
import {
  AccountsHelper,
  AggregationsHelper,
  CategoriesHelper,
  TransactionsHelper,
} from '../../helpers/mybalance';
import type { ITransactionFilters } from '../../helpers/mybalance/transactions.helper';
import type { McpPrincipal } from '../context';
import { withDefaultSpreadsheet } from '../context';
import { resourceNotFound, toMcpErrorResult } from '../errors';
import {
  dataOutputSchema,
  emptyInputSchema,
  getCategoryInputSchema,
  getMovementInputSchema,
  listAccountsInputSchema,
  listTransactionsDeltaInputSchema,
  listTransactionsInputSchema,
  monthlyAggregationsInputSchema,
} from '../schemas';

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

async function executeReadTool<T>(name: string, operation: () => Promise<T>) {
  const startedAt = Date.now();

  try {
    const data = await operation();
    const structuredContent = { data };
    console.info(`[MCP] ${name} completed in ${Date.now() - startedAt}ms`);

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(structuredContent) }],
      structuredContent,
    };
  } catch (error) {
    console.warn(`[MCP] ${name} failed after ${Date.now() - startedAt}ms`);
    return toMcpErrorResult(error);
  }
}

export function registerReadTools(server: McpServer, principal: McpPrincipal): void {
  server.registerTool(
    'list_accounts',
    {
      title: 'List accounts',
      description: "List the authenticated user's accounts from their default spreadsheet.",
      inputSchema: listAccountsInputSchema,
      outputSchema: dataOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async ({ calculateBalance }) =>
      executeReadTool('list_accounts', () =>
        withDefaultSpreadsheet(principal, (authClient, spreadsheetId) =>
          AccountsHelper.getAccounts(spreadsheetId, authClient, calculateBalance),
        ),
      ),
  );

  server.registerTool(
    'list_categories',
    {
      title: 'List categories',
      description: "List the authenticated user's categories from their default spreadsheet.",
      inputSchema: emptyInputSchema,
      outputSchema: dataOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async () =>
      executeReadTool('list_categories', () =>
        withDefaultSpreadsheet(principal, (authClient, spreadsheetId) =>
          CategoriesHelper.getCategories(spreadsheetId, authClient),
        ),
      ),
  );

  server.registerTool(
    'get_category',
    {
      title: 'Get category',
      description: "Get one category by its exact name from the authenticated user's spreadsheet.",
      inputSchema: getCategoryInputSchema,
      outputSchema: dataOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async ({ categoryName }) =>
      executeReadTool('get_category', () =>
        withDefaultSpreadsheet(principal, async (authClient, spreadsheetId) => {
          const categories = await CategoriesHelper.getCategories(spreadsheetId, authClient);
          const category = categories.find((item) => item.name === categoryName);
          if (!category) throw resourceNotFound('Category');
          return category;
        }),
      ),
  );

  server.registerTool(
    'list_movements',
    {
      title: 'List movements',
      description:
        "List all logical movements and their transactions from the authenticated user's spreadsheet.",
      inputSchema: emptyInputSchema,
      outputSchema: dataOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async () =>
      executeReadTool('list_movements', () =>
        withDefaultSpreadsheet(principal, (authClient, spreadsheetId) =>
          TransactionsHelper.listMovements(authClient, spreadsheetId),
        ),
      ),
  );

  server.registerTool(
    'get_movement',
    {
      title: 'Get movement',
      description: "Get one logical movement by ID from the authenticated user's spreadsheet.",
      inputSchema: getMovementInputSchema,
      outputSchema: dataOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async ({ movementId }) =>
      executeReadTool('get_movement', () =>
        withDefaultSpreadsheet(principal, async (authClient, spreadsheetId) => {
          const movement = await TransactionsHelper.getMovement(
            authClient,
            spreadsheetId,
            movementId,
          );
          if (!movement) throw resourceNotFound('Movement');
          return movement;
        }),
      ),
  );

  server.registerTool(
    'list_transactions',
    {
      title: 'List transactions',
      description:
        "List the authenticated user's transactions with optional filters and pagination. Dates use dd-MM-yyyy.",
      inputSchema: listTransactionsInputSchema,
      outputSchema: dataOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async ({ fromDate, toDate, account, category, type, status, limit, offset }) => {
      const filters: ITransactionFilters = {
        from_date: fromDate,
        to_date: toDate,
        account,
        category,
        type,
        status,
        limit,
        offset,
      };

      return executeReadTool('list_transactions', () =>
        withDefaultSpreadsheet(principal, (authClient, spreadsheetId) =>
          TransactionsHelper.listTransactions(authClient, spreadsheetId, filters),
        ),
      );
    },
  );

  server.registerTool(
    'list_transactions_delta',
    {
      title: 'List changed transactions',
      description:
        "List transactions changed since an ISO timestamp from the authenticated user's spreadsheet.",
      inputSchema: listTransactionsDeltaInputSchema,
      outputSchema: dataOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async ({ since }) =>
      executeReadTool('list_transactions_delta', () =>
        withDefaultSpreadsheet(principal, (authClient, spreadsheetId) =>
          TransactionsHelper.listTransactionsDelta(authClient, spreadsheetId, since),
        ),
      ),
  );

  server.registerTool(
    'get_monthly_aggregations',
    {
      title: 'Get monthly aggregations',
      description:
        'Get monthly income, expense and balance aggregations. Optional dates use dd-MM-yyyy.',
      inputSchema: monthlyAggregationsInputSchema,
      outputSchema: dataOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async ({ fromDate, toDate }) =>
      executeReadTool('get_monthly_aggregations', () =>
        withDefaultSpreadsheet(principal, (authClient, spreadsheetId) =>
          AggregationsHelper.getMonthlyAggregations(authClient, spreadsheetId, fromDate, toDate),
        ),
      ),
  );
}
