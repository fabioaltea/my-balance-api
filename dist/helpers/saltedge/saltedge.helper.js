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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SaltEdgeHelper = exports.SaltEdgeError = void 0;
const crypto_1 = __importDefault(require("crypto"));
class SaltEdgeError extends Error {
    constructor(message, code = 'SALTEDGE_ERROR', httpStatus = 500) {
        super(message);
        this.name = 'SaltEdgeError';
        this.code = code;
        this.httpStatus = httpStatus;
    }
}
exports.SaltEdgeError = SaltEdgeError;
// ============================================================================
// SALTEDGE HELPER — Account Information API v6
// ============================================================================
class SaltEdgeHelper {
    static get appId() {
        const id = process.env.SALTEDGE_APP_ID;
        if (!id)
            throw new SaltEdgeError('SALTEDGE_APP_ID env var missing', 'SALTEDGE_CONFIG_ERROR');
        return id;
    }
    static get secret() {
        const s = process.env.SALTEDGE_SECRET;
        if (!s)
            throw new SaltEdgeError('SALTEDGE_SECRET env var missing', 'SALTEDGE_CONFIG_ERROR');
        return s;
    }
    // RSA private key in PEM format — required only for Live status clients
    static get privateKey() {
        return process.env.SALTEDGE_PRIVATE_KEY || null;
    }
    // SaltEdge public key in PEM format — used for webhook signature verification
    static get saltEdgePublicKey() {
        return process.env.SALTEDGE_PUBLIC_KEY || null;
    }
    // ============================================================================
    // REQUEST SIGNING (Live status only)
    // ============================================================================
    static buildSignature(expiresAt, method, url, body) {
        const privateKey = SaltEdgeHelper.privateKey;
        if (!privateKey) {
            throw new SaltEdgeError('SALTEDGE_PRIVATE_KEY required for Live status request signing', 'SALTEDGE_SIGNING_ERROR');
        }
        const payload = `${expiresAt}|${method.toUpperCase()}|${url}|${body}`;
        const sign = crypto_1.default.createSign('RSA-SHA256');
        sign.update(payload);
        sign.end();
        return sign.sign(privateKey, 'base64');
    }
    // ============================================================================
    // HTTP CLIENT
    // ============================================================================
    static request(method, path, body, queryParams) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const qs = queryParams ? '?' + new URLSearchParams(queryParams).toString() : '';
            const url = `${SaltEdgeHelper.BASE_URL}${path}${qs}`;
            const bodyStr = body ? JSON.stringify(body) : '';
            const headers = {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'App-id': SaltEdgeHelper.appId,
                Secret: SaltEdgeHelper.secret,
            };
            // Add signature headers if private key is configured (Live mode)
            if (SaltEdgeHelper.privateKey) {
                const expiresAt = Math.floor(Date.now() / 1000) + 60;
                headers['Expires-at'] = String(expiresAt);
                headers['Signature'] = SaltEdgeHelper.buildSignature(expiresAt, method, url, bodyStr);
            }
            const fetchOptions = {
                method,
                headers,
            };
            if (body && method !== 'GET') {
                fetchOptions.body = bodyStr;
            }
            let response;
            try {
                response = yield fetch(url, fetchOptions);
            }
            catch (networkError) {
                throw new SaltEdgeError(`SaltEdge network error: ${networkError.message}`, 'SALTEDGE_NETWORK_ERROR');
            }
            let json;
            try {
                json = yield response.json();
            }
            catch (_c) {
                throw new SaltEdgeError(`SaltEdge returned non-JSON response (${response.status})`, 'SALTEDGE_PARSE_ERROR', response.status);
            }
            if (!response.ok) {
                const errClass = ((_a = json === null || json === void 0 ? void 0 : json.error) === null || _a === void 0 ? void 0 : _a.class) || 'UnknownError';
                const errMsg = ((_b = json === null || json === void 0 ? void 0 : json.error) === null || _b === void 0 ? void 0 : _b.message) || `HTTP ${response.status}`;
                throw new SaltEdgeError(`SaltEdge ${errClass}: ${errMsg}`, errClass, response.status);
            }
            return json;
        });
    }
    // ============================================================================
    // CUSTOMERS
    // ============================================================================
    static createCustomer(identifier) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield SaltEdgeHelper.request('POST', '/customers', {
                data: { identifier },
            });
            return res.data;
        });
    }
    static getCustomer(customerId) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield SaltEdgeHelper.request('GET', `/customers/${customerId}`);
            return res.data;
        });
    }
    static deleteCustomer(customerId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield SaltEdgeHelper.request('DELETE', `/customers/${customerId}`);
        });
    }
    // ============================================================================
    // CONNECT SESSIONS — returns the widget URL the user opens in a WebView/browser
    // ============================================================================
    static createConnectSession(options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f;
            const res = yield SaltEdgeHelper.request('POST', '/connect_sessions/create', {
                data: Object.assign({ customer_id: options.customer_id, consent: {
                        scopes: (_a = options.fetch_scopes) !== null && _a !== void 0 ? _a : ['account_details', 'transactions_details'],
                        from_date: options.from_date,
                    }, attempt: {
                        fetch_scopes: (_b = options.fetch_scopes) !== null && _b !== void 0 ? _b : ['accounts', 'transactions'],
                        return_to: options.return_to,
                        locale: (_c = options.locale) !== null && _c !== void 0 ? _c : 'en',
                        include_fake_providers: (_d = options.include_fake_providers) !== null && _d !== void 0 ? _d : false,
                        daily_refresh: (_e = options.daily_refresh) !== null && _e !== void 0 ? _e : false,
                        show_consent_confirmation: (_f = options.show_consent_confirmation) !== null && _f !== void 0 ? _f : true,
                    } }, (options.provider_code ? { provider_code: options.provider_code } : {})),
            });
            return res.data;
        });
    }
    static createReconnectSession(options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const res = yield SaltEdgeHelper.request('POST', '/connect_sessions/reconnect', {
                data: {
                    connection_id: options.connection_id,
                    customer_id: options.customer_id,
                    attempt: {
                        fetch_scopes: (_a = options.fetch_scopes) !== null && _a !== void 0 ? _a : ['accounts', 'transactions'],
                        return_to: options.return_to,
                        locale: (_b = options.locale) !== null && _b !== void 0 ? _b : 'en',
                        from_date: options.from_date,
                    },
                },
            });
            return res.data;
        });
    }
    static createRefreshSession(options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const res = yield SaltEdgeHelper.request('POST', '/connect_sessions/refresh', {
                data: {
                    connection_id: options.connection_id,
                    customer_id: options.customer_id,
                    attempt: {
                        fetch_scopes: (_a = options.fetch_scopes) !== null && _a !== void 0 ? _a : ['accounts', 'transactions'],
                        from_date: options.from_date,
                    },
                },
            });
            return res.data;
        });
    }
    // ============================================================================
    // CONNECTIONS
    // ============================================================================
    static listConnections(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = { customer_id: params.customer_id };
            if (params.from_id)
                query.from_id = params.from_id;
            return SaltEdgeHelper.request('GET', '/connections', undefined, query);
        });
    }
    static getConnection(connectionId) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield SaltEdgeHelper.request('GET', `/connections/${connectionId}`);
            return res.data;
        });
    }
    static deleteConnection(connectionId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield SaltEdgeHelper.request('DELETE', `/connections/${connectionId}`);
        });
    }
    // ============================================================================
    // ACCOUNTS
    // ============================================================================
    static listAccounts(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = { connection_id: params.connection_id };
            if (params.customer_id)
                query.customer_id = params.customer_id;
            if (params.from_id)
                query.from_id = params.from_id;
            return SaltEdgeHelper.request('GET', '/accounts', undefined, query);
        });
    }
    // ============================================================================
    // TRANSACTIONS
    // ============================================================================
    static listTransactions(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = { connection_id: params.connection_id };
            if (params.account_id)
                query.account_id = params.account_id;
            if (params.from_id)
                query.from_id = params.from_id;
            if (params.from_made_on)
                query.from_made_on = params.from_made_on;
            if (params.to_made_on)
                query.to_made_on = params.to_made_on;
            if (params.duplicated !== undefined)
                query.duplicated = String(params.duplicated);
            return SaltEdgeHelper.request('GET', '/transactions', undefined, query);
        });
    }
    static listPendingTransactions(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = { connection_id: params.connection_id };
            if (params.account_id)
                query.account_id = params.account_id;
            if (params.from_id)
                query.from_id = params.from_id;
            if (params.from_made_on)
                query.from_made_on = params.from_made_on;
            if (params.to_made_on)
                query.to_made_on = params.to_made_on;
            return SaltEdgeHelper.request('GET', '/transactions/pending', undefined, query);
        });
    }
    /**
     * Fetch all pages of transactions — use carefully on large datasets
     */
    static listAllTransactions(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const all = [];
            let fromId = params.from_id;
            while (true) {
                const page = yield SaltEdgeHelper.listTransactions(Object.assign(Object.assign({}, params), { from_id: fromId }));
                all.push(...page.data);
                if (!page.meta.next_id)
                    break;
                fromId = page.meta.next_id;
            }
            return all;
        });
    }
    // ============================================================================
    // WEBHOOK VERIFICATION
    // ============================================================================
    /**
     * Verify the signature on a SaltEdge webhook payload.
     * SaltEdge signs the body with their private key; verify with their public key.
     * Store the public key PEM in SALTEDGE_PUBLIC_KEY env var.
     */
    static verifyWebhookSignature(rawBody, signatureHeader, expiresAt) {
        const publicKey = SaltEdgeHelper.saltEdgePublicKey;
        if (!publicKey) {
            console.warn('SALTEDGE_PUBLIC_KEY not set — skipping webhook signature verification');
            return false;
        }
        try {
            // SaltEdge v6 webhook signature: Base64(RSA-SHA256(expires_at + "|" + body))
            const payload = `${expiresAt}|${rawBody}`;
            const verify = crypto_1.default.createVerify('RSA-SHA256');
            verify.update(payload);
            verify.end();
            return verify.verify(publicKey, signatureHeader, 'base64');
        }
        catch (error) {
            console.error('SaltEdge webhook signature verification failed:', error.message);
            return false;
        }
    }
    // ============================================================================
    // CONVENIENCE: FULL SYNC — fetch all accounts + transactions for a connection
    // ============================================================================
    static syncConnection(connectionId, fromDate) {
        return __awaiter(this, void 0, void 0, function* () {
            const [accountsPage, transactions] = yield Promise.all([
                SaltEdgeHelper.listAccounts({ connection_id: connectionId }),
                SaltEdgeHelper.listAllTransactions({
                    connection_id: connectionId,
                    from_made_on: fromDate,
                }),
            ]);
            return {
                accounts: accountsPage.data,
                transactions,
            };
        });
    }
}
exports.SaltEdgeHelper = SaltEdgeHelper;
SaltEdgeHelper.BASE_URL = 'https://www.saltedge.com/api/v6';
//# sourceMappingURL=saltedge.helper.js.map