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
exports.SaltEdgeController = void 0;
const saltedge_1 = require("../helpers/saltedge");
const mybalance_1 = require("../helpers/mybalance");
const mybalance_2 = require("../helpers/mybalance");
const google_1 = require("../helpers/google");
const db_helper_1 = require("../helpers/db.helper");
// ============================================================================
// UTILS
// ============================================================================
function handleError(error, res, context) {
    if (error instanceof google_1.GoogleTokenError) {
        res
            .status(401)
            .json({ success: false, error: error.message, code: error.code, requiresReauth: true });
        return;
    }
    if (error instanceof saltedge_1.SaltEdgeError) {
        res.status(error.httpStatus).json({ success: false, error: error.message, code: error.code });
        return;
    }
    console.error(`Error in ${context}:`, error);
    res.status(500).json({ success: false, error: 'Internal server error', details: error === null || error === void 0 ? void 0 : error.message });
}
/** Ensure the user has a SaltEdge customer. Creates one if missing. */
function ensureCustomer(userEmail) {
    return __awaiter(this, void 0, void 0, function* () {
        let customerId = yield db_helper_1.DbHelper.getSaltEdgeCustomerId(userEmail);
        if (!customerId) {
            const customer = yield saltedge_1.SaltEdgeHelper.createCustomer(userEmail);
            customerId = customer.id;
            yield db_helper_1.DbHelper.storeSaltEdgeCustomerId(userEmail, customerId);
        }
        return customerId;
    });
}
/** Convert SaltEdge amount (signed float) to MyBalance string format "45,50" */
function formatAmount(amount) {
    return Math.abs(amount).toFixed(2).replace('.', ',');
}
/** Convert SaltEdge date "yyyy-MM-dd" to MyBalance "dd-MM-yyyy" */
function convertDate(saltedgeDate) {
    const [y, m, d] = saltedgeDate.split('-');
    return `${d}-${m}-${y}`;
}
/** Map a SaltEdge transaction to a MyBalance IMovementRequest */
function mapToMovementRequest(tx, accountName) {
    var _a, _b;
    const type = tx.amount >= 0 ? 'in' : 'out';
    return {
        description: tx.description || ((_a = tx.extra) === null || _a === void 0 ? void 0 : _a.payee) || ((_b = tx.extra) === null || _b === void 0 ? void 0 : _b.merchant_id) || 'SaltEdge import',
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
class SaltEdgeController {
    /**
     * POST /saltedge/connect
     * Body: { accountId?: string, returnTo?: string, locale?: string, fromDate?: string }
     * Creates a Connect Widget session and returns the connect_url.
     * If accountId provided, the widget result will be linked to that account.
     */
    static connect(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userEmail = req.userId;
                const { accountId, returnTo, locale, fromDate } = req.body;
                const customerId = yield ensureCustomer(userEmail);
                const session = yield saltedge_1.SaltEdgeHelper.createConnectSession({
                    customer_id: customerId,
                    return_to: returnTo,
                    locale: locale !== null && locale !== void 0 ? locale : 'en',
                    from_date: fromDate,
                });
                res.json({
                    success: true,
                    data: {
                        connectUrl: session.connect_url,
                        expiresAt: session.expires_at,
                        customerId,
                        // client stores accountId and passes it back on webhook/callback
                        accountId: accountId !== null && accountId !== void 0 ? accountId : null,
                    },
                });
            }
            catch (error) {
                handleError(error, res, 'saltedge.connect');
            }
        });
    }
    /**
     * POST /saltedge/reconnect/:accountId
     * Reconnect Widget for an account already linked to SaltEdge.
     */
    static reconnect(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userEmail = req.userId;
                const { accountId } = req.params;
                const { returnTo, locale } = req.body;
                const deviceType = req.deviceType || 'web';
                const spreadsheetId = yield google_1.GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
                if (!spreadsheetId) {
                    res.status(400).json({ success: false, error: 'No spreadsheet configured' });
                    return;
                }
                const account = yield google_1.GoogleAuthHelper.executeWithRetry(userEmail, deviceType, (client) => __awaiter(this, void 0, void 0, function* () {
                    var _a;
                    const accounts = yield mybalance_1.AccountsHelper.getAccounts(spreadsheetId, client, false);
                    return (_a = accounts.find((a) => a.accountId === accountId)) !== null && _a !== void 0 ? _a : null;
                }));
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
                const customerId = yield ensureCustomer(userEmail);
                const session = yield saltedge_1.SaltEdgeHelper.createReconnectSession({
                    connection_id: account.saltedgeConnectionId,
                    customer_id: customerId,
                    return_to: returnTo,
                    locale: locale !== null && locale !== void 0 ? locale : 'en',
                });
                res.json({
                    success: true,
                    data: { connectUrl: session.connect_url, expiresAt: session.expires_at },
                });
            }
            catch (error) {
                handleError(error, res, 'saltedge.reconnect');
            }
        });
    }
    /**
     * POST /saltedge/link
     * Body: { accountId, saltedgeConnectionId, saltedgeAccountId }
     * Called after widget completes — links the SE connection to a MyBalance account.
     */
    static link(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
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
                const spreadsheetId = yield google_1.GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
                if (!spreadsheetId) {
                    res.status(400).json({ success: false, error: 'No spreadsheet configured' });
                    return;
                }
                const updated = yield google_1.GoogleAuthHelper.executeWithRetry(userEmail, deviceType, (client) => __awaiter(this, void 0, void 0, function* () {
                    return mybalance_1.AccountsHelper.linkSaltEdge(spreadsheetId, client, accountId, saltedgeConnectionId, saltedgeAccountId);
                }));
                res.json({ success: true, data: updated });
            }
            catch (error) {
                handleError(error, res, 'saltedge.link');
            }
        });
    }
    /**
     * DELETE /saltedge/disconnect/:accountId
     * Unlinks SE connection from sheet + deletes the connection on SaltEdge.
     */
    static disconnect(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userEmail = req.userId;
                const { accountId } = req.params;
                const deviceType = req.deviceType || 'web';
                const spreadsheetId = yield google_1.GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
                if (!spreadsheetId) {
                    res.status(400).json({ success: false, error: 'No spreadsheet configured' });
                    return;
                }
                // Read account to get the connection ID before unlinking
                const account = yield google_1.GoogleAuthHelper.executeWithRetry(userEmail, deviceType, (client) => __awaiter(this, void 0, void 0, function* () {
                    var _a;
                    const accounts = yield mybalance_1.AccountsHelper.getAccounts(spreadsheetId, client, false);
                    return (_a = accounts.find((a) => a.accountId === accountId)) !== null && _a !== void 0 ? _a : null;
                }));
                if (!account) {
                    res.status(404).json({ success: false, error: 'Account not found' });
                    return;
                }
                // Delete connection on SaltEdge (best effort — don't fail if already gone)
                if (account.saltedgeConnectionId) {
                    try {
                        yield saltedge_1.SaltEdgeHelper.deleteConnection(account.saltedgeConnectionId);
                    }
                    catch (err) {
                        console.warn('SaltEdge connection delete failed (ignored):', err.message);
                    }
                }
                // Unlink in the sheet
                yield google_1.GoogleAuthHelper.executeWithRetry(userEmail, deviceType, (client) => __awaiter(this, void 0, void 0, function* () { return mybalance_1.AccountsHelper.unlinkSaltEdge(spreadsheetId, client, accountId); }));
                res.json({ success: true });
            }
            catch (error) {
                handleError(error, res, 'saltedge.disconnect');
            }
        });
    }
    /**
     * POST /saltedge/sync/:accountId
     * Fetches new transactions from SaltEdge and appends them to Google Sheets.
     * Uses lastSyncedAt as from_date; defaults to 30 days ago on first sync.
     */
    static sync(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userEmail = req.userId;
                const { accountId } = req.params;
                const deviceType = req.deviceType || 'web';
                const spreadsheetId = yield google_1.GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
                if (!spreadsheetId) {
                    res.status(400).json({ success: false, error: 'No spreadsheet configured' });
                    return;
                }
                // Find the account
                const accounts = yield google_1.GoogleAuthHelper.executeWithRetry(userEmail, deviceType, (client) => __awaiter(this, void 0, void 0, function* () { return mybalance_1.AccountsHelper.getAccounts(spreadsheetId, client, false); }));
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
                let fromDate;
                if (account.lastSyncedAt) {
                    // lastSyncedAt is ISO — convert to yyyy-MM-dd for SaltEdge
                    fromDate = account.lastSyncedAt.split('T')[0];
                }
                else {
                    const d = new Date();
                    d.setDate(d.getDate() - 30);
                    fromDate = d.toISOString().split('T')[0];
                }
                // Fetch transactions from SaltEdge
                const transactions = yield saltedge_1.SaltEdgeHelper.listAllTransactions({
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
                    if (tx.duplicated)
                        continue;
                    const movementRequest = mapToMovementRequest(tx, account.name);
                    yield google_1.GoogleAuthHelper.executeWithRetry(userEmail, deviceType, (client) => __awaiter(this, void 0, void 0, function* () { return mybalance_2.TransactionsHelper.appendMovement(client, spreadsheetId, movementRequest); }));
                    imported++;
                }
                // Update lastSyncedAt on the account row
                yield google_1.GoogleAuthHelper.executeWithRetry(userEmail, deviceType, (client) => __awaiter(this, void 0, void 0, function* () { return mybalance_1.AccountsHelper.updateLastSynced(spreadsheetId, client, accountId); }));
                res.json({ success: true, data: { imported, fromDate } });
            }
            catch (error) {
                handleError(error, res, 'saltedge.sync');
            }
        });
    }
    /**
     * GET /saltedge/connections/:accountId
     * Returns the SaltEdge connection status for a linked account.
     */
    static getConnection(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userEmail = req.userId;
                const { accountId } = req.params;
                const deviceType = req.deviceType || 'web';
                const spreadsheetId = yield google_1.GoogleAuthHelper.getSpreadsheetIdForUser(userEmail);
                if (!spreadsheetId) {
                    res.status(400).json({ success: false, error: 'No spreadsheet configured' });
                    return;
                }
                const accounts = yield google_1.GoogleAuthHelper.executeWithRetry(userEmail, deviceType, (client) => __awaiter(this, void 0, void 0, function* () { return mybalance_1.AccountsHelper.getAccounts(spreadsheetId, client, false); }));
                const account = accounts.find((a) => a.accountId === accountId);
                if (!account) {
                    res.status(404).json({ success: false, error: 'Account not found' });
                    return;
                }
                if (!account.saltedgeConnectionId) {
                    res.json({ success: true, data: { linked: false } });
                    return;
                }
                const connection = yield saltedge_1.SaltEdgeHelper.getConnection(account.saltedgeConnectionId);
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
            }
            catch (error) {
                handleError(error, res, 'saltedge.getConnection');
            }
        });
    }
    // ============================================================================
    // WEBHOOK — public endpoint, no JWT auth
    // ============================================================================
    /**
     * POST /saltedge/webhook
     * Receives SaltEdge async events. Verifies RSA signature.
     * Headers: Expires-at, Signature
     */
    static webhook(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g;
            // Verify signature if public key is configured
            const expiresAt = req.headers['expires-at'];
            const signature = req.headers['signature'];
            const rawBody = (_a = req.rawBody) !== null && _a !== void 0 ? _a : JSON.stringify(req.body);
            if (signature) {
                const valid = saltedge_1.SaltEdgeHelper.verifyWebhookSignature(rawBody, signature, expiresAt);
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
            const eventType = (_e = (_c = (_b = payload === null || payload === void 0 ? void 0 : payload.data) === null || _b === void 0 ? void 0 : _b.stage) !== null && _c !== void 0 ? _c : (_d = payload === null || payload === void 0 ? void 0 : payload.meta) === null || _d === void 0 ? void 0 : _d.type) !== null && _e !== void 0 ? _e : 'unknown';
            const connectionId = (_f = payload === null || payload === void 0 ? void 0 : payload.data) === null || _f === void 0 ? void 0 : _f.connection_id;
            console.log(`[SaltEdge webhook] event=${eventType} connection=${connectionId}`);
            try {
                switch (eventType) {
                    case 'finish':
                        // connection.success — data is available, connection is ready to sync
                        console.log(`[SaltEdge webhook] Connection ${connectionId} finished successfully`);
                        break;
                    case 'error':
                        console.error(`[SaltEdge webhook] Connection ${connectionId} error:`, (_g = payload === null || payload === void 0 ? void 0 : payload.data) === null || _g === void 0 ? void 0 : _g.error_message);
                        break;
                    case 'interactive':
                        // Requires user interaction (MFA, captcha) — frontend must reopen widget
                        console.log(`[SaltEdge webhook] Connection ${connectionId} requires interaction`);
                        break;
                    default:
                        console.log(`[SaltEdge webhook] Unhandled event: ${eventType}`);
                }
            }
            catch (err) {
                // Don't return 500 — SaltEdge retries on non-2xx responses
                console.error('[SaltEdge webhook] Processing error:', err.message);
            }
            res.status(200).json({ success: true });
        });
    }
}
exports.SaltEdgeController = SaltEdgeController;
//# sourceMappingURL=saltedge.controller.js.map