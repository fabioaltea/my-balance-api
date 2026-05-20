import { Request, Response } from 'express';
import { SaltEdgeHelper, SaltEdgeError } from '../helpers/saltedge';
import { AccountsHelper } from '../helpers/mybalance';
import { TransactionsHelper } from '../helpers/mybalance';
import { GoogleAuthHelper, GoogleTokenError } from '../helpers/google';
import { DbHelper } from '../helpers/db.helper';
import { SaltEdgeTransaction } from '../models/saltedge.interfaces';
import { IMovementRequest } from '../models';

// ============================================================================
// UTILS
// ============================================================================

function handleError(error: any, res: Response, context: string): void {
  if (error instanceof GoogleTokenError) {
    res
      .status(401)
      .json({ success: false, error: error.message, code: error.code, requiresReauth: true });
    return;
  }
  if (error instanceof SaltEdgeError) {
    res.status(error.httpStatus).json({ success: false, error: error.message, code: error.code });
    return;
  }
  console.error(`Error in ${context}:`, error);
  res.status(500).json({ success: false, error: 'Internal server error', details: error?.message });
}

/** Ensure the user has a SaltEdge customer. Creates one if missing. */
async function ensureCustomer(userEmail: string): Promise<string> {
  let customerId = await DbHelper.getSaltEdgeCustomerId(userEmail);
  if (!customerId) {
    const customer = await SaltEdgeHelper.createCustomer(userEmail);
    customerId = customer.id;
    await DbHelper.storeSaltEdgeCustomerId(userEmail, customerId);
  }
  return customerId;
}

/** Convert SaltEdge amount (signed float) to MyBalance string format "45,50" */
function formatAmount(amount: number): string {
  return Math.abs(amount).toFixed(2).replace('.', ',');
}

/** Convert SaltEdge date "yyyy-MM-dd" to MyBalance "dd-MM-yyyy" */
function convertDate(saltedgeDate: string): string {
  const [y, m, d] = saltedgeDate.split('-');
  return `${d}-${m}-${y}`;
}

/** Map a SaltEdge transaction to a MyBalance IMovementRequest */
function mapToMovementRequest(tx: SaltEdgeTransaction, accountName: string): IMovementRequest {
  const type = tx.amount >= 0 ? 'in' : 'out';
  return {
    description: tx.description || tx.extra?.payee || tx.extra?.merchant_id || 'SaltEdge import',
    category: tx.category || '',
    date: convertDate(tx.made_on),
    type,
    notes: `saltedge:${tx.id}`,
    status: 'Confirmed',
    transactions: [
      {
        amount: (type === 'out' ? '-' : '') + formatAmount(tx.amount),
        account: accountName,
        type,
        _operation: 'create',
      },
    ],
  };
}

// ============================================================================
// CONTROLLER
// ============================================================================

export class SaltEdgeController {
  /**
   * POST /saltedge/connect
   * Body: { accountId?: string, returnTo?: string, locale?: string, fromDate?: string }
   * Creates a Connect Widget session and returns the connect_url.
   * If accountId provided, the widget result will be linked to that account.
   */
  public static async connect(req: any, res: Response): Promise<void> {
    try {
      const userEmail = req.userId;
      const { accountId, returnTo, locale, fromDate } = req.body;

      const customerId = await ensureCustomer(userEmail);

      const session = await SaltEdgeHelper.createConnectSession({
        customer_id: customerId,
        return_to: returnTo,
        locale: locale ?? 'en',
        from_date: fromDate,
      });

      res.json({
        success: true,
        data: {
          connectUrl: session.connect_url,
          expiresAt: session.expires_at,
          customerId,
          // client stores accountId and passes it back on webhook/callback
          accountId: accountId ?? null,
        },
      });
    } catch (error: any) {
      handleError(error, res, 'saltedge.connect');
    }
  }

  /**
   * POST /saltedge/reconnect/:accountId
   * Reconnect Widget for an account already linked to SaltEdge.
   */
  public static async reconnect(req: any, res: Response): Promise<void> {
    try {
      const userEmail = req.userId;
      const { accountId } = req.params;
      const { returnTo, locale } = req.body;
      const deviceType = req.deviceType || 'web';

      const spreadsheetId = await GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
      if (!spreadsheetId) {
        res.status(400).json({ success: false, error: 'No spreadsheet configured' });
        return;
      }

      const account = await GoogleAuthHelper.executeWithRetry(
        userEmail,
        deviceType,
        async (client) => {
          const accounts = await AccountsHelper.getAccounts(spreadsheetId, client, false);
          return accounts.find((a) => a.accountId === accountId) ?? null;
        },
      );

      if (!account) {
        res.status(404).json({ success: false, error: 'Account not found' });
        return;
      }
      if (!account.saltedgeConnectionId) {
        res
          .status(400)
          .json({ success: false, error: 'Account has no SaltEdge connection linked' });
        return;
      }

      const customerId = await ensureCustomer(userEmail);

      const session = await SaltEdgeHelper.createReconnectSession({
        connection_id: account.saltedgeConnectionId,
        customer_id: customerId,
        return_to: returnTo,
        locale: locale ?? 'en',
      });

      res.json({
        success: true,
        data: { connectUrl: session.connect_url, expiresAt: session.expires_at },
      });
    } catch (error: any) {
      handleError(error, res, 'saltedge.reconnect');
    }
  }

  /**
   * POST /saltedge/link
   * Body: { accountId, saltedgeConnectionId, saltedgeAccountId }
   * Called after widget completes — links the SE connection to a MyBalance account.
   */
  public static async link(req: any, res: Response): Promise<void> {
    try {
      const userEmail = req.userId;
      const { accountId, saltedgeConnectionId, saltedgeAccountId } = req.body;
      const deviceType = req.deviceType || 'web';

      if (!accountId || !saltedgeConnectionId || !saltedgeAccountId) {
        res.status(400).json({
          success: false,
          error: 'accountId, saltedgeConnectionId and saltedgeAccountId are required',
        });
        return;
      }

      const spreadsheetId = await GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
      if (!spreadsheetId) {
        res.status(400).json({ success: false, error: 'No spreadsheet configured' });
        return;
      }

      const updated = await GoogleAuthHelper.executeWithRetry(
        userEmail,
        deviceType,
        async (client) =>
          AccountsHelper.linkSaltEdge(
            spreadsheetId,
            client,
            accountId,
            saltedgeConnectionId,
            saltedgeAccountId,
          ),
      );

      res.json({ success: true, data: updated });
    } catch (error: any) {
      handleError(error, res, 'saltedge.link');
    }
  }

  /**
   * DELETE /saltedge/disconnect/:accountId
   * Unlinks SE connection from sheet + deletes the connection on SaltEdge.
   */
  public static async disconnect(req: any, res: Response): Promise<void> {
    try {
      const userEmail = req.userId;
      const { accountId } = req.params;
      const deviceType = req.deviceType || 'web';

      const spreadsheetId = await GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
      if (!spreadsheetId) {
        res.status(400).json({ success: false, error: 'No spreadsheet configured' });
        return;
      }

      // Read account to get the connection ID before unlinking
      const account = await GoogleAuthHelper.executeWithRetry(
        userEmail,
        deviceType,
        async (client) => {
          const accounts = await AccountsHelper.getAccounts(spreadsheetId, client, false);
          return accounts.find((a) => a.accountId === accountId) ?? null;
        },
      );

      if (!account) {
        res.status(404).json({ success: false, error: 'Account not found' });
        return;
      }

      // Delete connection on SaltEdge (best effort — don't fail if already gone)
      if (account.saltedgeConnectionId) {
        try {
          await SaltEdgeHelper.deleteConnection(account.saltedgeConnectionId);
        } catch (err: any) {
          console.warn('SaltEdge connection delete failed (ignored):', err.message);
        }
      }

      // Unlink in the sheet
      await GoogleAuthHelper.executeWithRetry(userEmail, deviceType, async (client) =>
        AccountsHelper.unlinkSaltEdge(spreadsheetId, client, accountId),
      );

      res.json({ success: true });
    } catch (error: any) {
      handleError(error, res, 'saltedge.disconnect');
    }
  }

  /**
   * POST /saltedge/sync/:accountId
   * Fetches new transactions from SaltEdge and appends them to Google Sheets.
   * Uses lastSyncedAt as from_date; defaults to 30 days ago on first sync.
   */
  public static async sync(req: any, res: Response): Promise<void> {
    try {
      const userEmail = req.userId;
      const { accountId } = req.params;
      const deviceType = req.deviceType || 'web';

      const spreadsheetId = await GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
      if (!spreadsheetId) {
        res.status(400).json({ success: false, error: 'No spreadsheet configured' });
        return;
      }

      // Find the account
      const accounts = await GoogleAuthHelper.executeWithRetry(
        userEmail,
        deviceType,
        async (client) => AccountsHelper.getAccounts(spreadsheetId, client, false),
      );
      const account = accounts.find((a) => a.accountId === accountId);

      if (!account) {
        res.status(404).json({ success: false, error: 'Account not found' });
        return;
      }
      if (!account.saltedgeAccountId || !account.saltedgeConnectionId) {
        res.status(400).json({ success: false, error: 'Account not linked to SaltEdge' });
        return;
      }

      // Determine from_date
      let fromDate: string | undefined;
      if (account.lastSyncedAt) {
        // lastSyncedAt is ISO — convert to yyyy-MM-dd for SaltEdge
        fromDate = account.lastSyncedAt.split('T')[0];
      } else {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        fromDate = d.toISOString().split('T')[0];
      }

      // Fetch transactions from SaltEdge
      const transactions = await SaltEdgeHelper.listAllTransactions({
        connection_id: account.saltedgeConnectionId,
        account_id: account.saltedgeAccountId,
        from_made_on: fromDate,
      });

      if (transactions.length === 0) {
        res.json({ success: true, data: { imported: 0 } });
        return;
      }

      // Append each transaction as a movement in Google Sheets
      let imported = 0;
      for (const tx of transactions) {
        // Skip duplicates (already imported in a previous sync)
        if (tx.duplicated) continue;

        const movementRequest = mapToMovementRequest(tx, account.name);

        await GoogleAuthHelper.executeWithRetry(userEmail, deviceType, async (client) =>
          TransactionsHelper.appendMovement(client, spreadsheetId, movementRequest),
        );
        imported++;
      }

      // Update lastSyncedAt on the account row
      await GoogleAuthHelper.executeWithRetry(userEmail, deviceType, async (client) =>
        AccountsHelper.updateLastSynced(spreadsheetId, client, accountId),
      );

      res.json({ success: true, data: { imported, fromDate } });
    } catch (error: any) {
      handleError(error, res, 'saltedge.sync');
    }
  }

  /**
   * GET /saltedge/connections/:accountId
   * Returns the SaltEdge connection status for a linked account.
   */
  public static async getConnection(req: any, res: Response): Promise<void> {
    try {
      const userEmail = req.userId;
      const { accountId } = req.params;
      const deviceType = req.deviceType || 'web';

      const spreadsheetId = await GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
      if (!spreadsheetId) {
        res.status(400).json({ success: false, error: 'No spreadsheet configured' });
        return;
      }

      const accounts = await GoogleAuthHelper.executeWithRetry(
        userEmail,
        deviceType,
        async (client) => AccountsHelper.getAccounts(spreadsheetId, client, false),
      );
      const account = accounts.find((a) => a.accountId === accountId);

      if (!account) {
        res.status(404).json({ success: false, error: 'Account not found' });
        return;
      }
      if (!account.saltedgeConnectionId) {
        res.json({ success: true, data: { linked: false } });
        return;
      }

      const connection = await SaltEdgeHelper.getConnection(account.saltedgeConnectionId);

      res.json({
        success: true,
        data: {
          linked: true,
          status: connection.status,
          providerName: connection.provider_name,
          lastSuccessAt: connection.last_success_at,
          lastSyncedAt: account.lastSyncedAt,
        },
      });
    } catch (error: any) {
      handleError(error, res, 'saltedge.getConnection');
    }
  }

  // ============================================================================
  // WEBHOOK — public endpoint, no JWT auth
  // ============================================================================

  /**
   * POST /saltedge/webhook
   * Receives SaltEdge async events. Verifies RSA signature.
   * Headers: Expires-at, Signature
   */
  public static async webhook(req: any, res: Response): Promise<void> {
    // Verify signature if public key is configured
    const expiresAt = req.headers['expires-at'] as string;
    const signature = req.headers['signature'] as string;
    const rawBody: string = req.rawBody ?? JSON.stringify(req.body);

    if (signature) {
      const valid = SaltEdgeHelper.verifyWebhookSignature(rawBody, signature, expiresAt);
      if (!valid) {
        res.status(401).json({ success: false, error: 'Invalid webhook signature' });
        return;
      }
    }

    // Check expiry
    if (expiresAt && Number(expiresAt) < Math.floor(Date.now() / 1000)) {
      res.status(401).json({ success: false, error: 'Webhook request expired' });
      return;
    }

    const payload = req.body;
    const eventType: string = payload?.data?.stage ?? payload?.meta?.type ?? 'unknown';
    const connectionId: string | undefined = payload?.data?.connection_id;

    console.log(`[SaltEdge webhook] event=${eventType} connection=${connectionId}`);

    try {
      switch (eventType) {
        case 'finish':
          // connection.success — data is available, connection is ready to sync
          console.log(`[SaltEdge webhook] Connection ${connectionId} finished successfully`);
          break;

        case 'error':
          console.error(
            `[SaltEdge webhook] Connection ${connectionId} error:`,
            payload?.data?.error_message,
          );
          break;

        case 'interactive':
          // Requires user interaction (MFA, captcha) — frontend must reopen widget
          console.log(`[SaltEdge webhook] Connection ${connectionId} requires interaction`);
          break;

        default:
          console.log(`[SaltEdge webhook] Unhandled event: ${eventType}`);
      }
    } catch (err: any) {
      // Don't return 500 — SaltEdge retries on non-2xx responses
      console.error('[SaltEdge webhook] Processing error:', err.message);
    }

    res.status(200).json({ success: true });
  }
}
