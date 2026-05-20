import crypto from 'crypto';
import {
  SaltEdgeCustomer,
  SaltEdgeConnection,
  SaltEdgeAccount,
  SaltEdgeTransaction,
  ConnectSessionOptions,
  ConnectSessionResponse,
  ReconnectSessionOptions,
  RefreshSessionOptions,
  ListConnectionsParams,
  ListAccountsParams,
  ListTransactionsParams,
  PaginatedResponse,
} from '../../models/saltedge.interfaces';

export class SaltEdgeError extends Error {
  public readonly code: string;
  public readonly httpStatus: number;

  constructor(message: string, code: string = 'SALTEDGE_ERROR', httpStatus: number = 500) {
    super(message);
    this.name = 'SaltEdgeError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

// ============================================================================
// SALTEDGE HELPER — Account Information API v6
// ============================================================================

export class SaltEdgeHelper {
  private static readonly BASE_URL = 'https://www.saltedge.com/api/v6';

  private static get appId(): string {
    const id = process.env.SALTEDGE_APP_ID;
    if (!id) throw new SaltEdgeError('SALTEDGE_APP_ID env var missing', 'SALTEDGE_CONFIG_ERROR');
    return id;
  }

  private static get secret(): string {
    const s = process.env.SALTEDGE_SECRET;
    if (!s) throw new SaltEdgeError('SALTEDGE_SECRET env var missing', 'SALTEDGE_CONFIG_ERROR');
    return s;
  }

  // RSA private key in PEM format — required only for Live status clients
  private static get privateKey(): string | null {
    return process.env.SALTEDGE_PRIVATE_KEY || null;
  }

  // SaltEdge public key in PEM format — used for webhook signature verification
  private static get saltEdgePublicKey(): string | null {
    return process.env.SALTEDGE_PUBLIC_KEY || null;
  }

  // ============================================================================
  // REQUEST SIGNING (Live status only)
  // ============================================================================

  private static buildSignature(
    expiresAt: number,
    method: string,
    url: string,
    body: string,
  ): string {
    const privateKey = SaltEdgeHelper.privateKey;
    if (!privateKey) {
      throw new SaltEdgeError(
        'SALTEDGE_PRIVATE_KEY required for Live status request signing',
        'SALTEDGE_SIGNING_ERROR',
      );
    }

    const payload = `${expiresAt}|${method.toUpperCase()}|${url}|${body}`;
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(payload);
    sign.end();
    return sign.sign(privateKey, 'base64');
  }

  // ============================================================================
  // HTTP CLIENT
  // ============================================================================

  private static async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: Record<string, unknown>,
    queryParams?: Record<string, string>,
  ): Promise<T> {
    const qs = queryParams ? '?' + new URLSearchParams(queryParams).toString() : '';
    const url = `${SaltEdgeHelper.BASE_URL}${path}${qs}`;
    const bodyStr = body ? JSON.stringify(body) : '';

    const headers: Record<string, string> = {
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

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    if (body && method !== 'GET') {
      fetchOptions.body = bodyStr;
    }

    let response: Response;
    try {
      response = await fetch(url, fetchOptions);
    } catch (networkError: any) {
      throw new SaltEdgeError(
        `SaltEdge network error: ${networkError.message}`,
        'SALTEDGE_NETWORK_ERROR',
      );
    }

    let json: any;
    try {
      json = await response.json();
    } catch {
      throw new SaltEdgeError(
        `SaltEdge returned non-JSON response (${response.status})`,
        'SALTEDGE_PARSE_ERROR',
        response.status,
      );
    }

    if (!response.ok) {
      const errClass = json?.error?.class || 'UnknownError';
      const errMsg = json?.error?.message || `HTTP ${response.status}`;
      throw new SaltEdgeError(`SaltEdge ${errClass}: ${errMsg}`, errClass, response.status);
    }

    return json as T;
  }

  // ============================================================================
  // CUSTOMERS
  // ============================================================================

  public static async createCustomer(identifier: string): Promise<SaltEdgeCustomer> {
    const res = await SaltEdgeHelper.request<{ data: SaltEdgeCustomer }>('POST', '/customers', {
      data: { identifier },
    });
    return res.data;
  }

  public static async getCustomer(customerId: string): Promise<SaltEdgeCustomer> {
    const res = await SaltEdgeHelper.request<{ data: SaltEdgeCustomer }>(
      'GET',
      `/customers/${customerId}`,
    );
    return res.data;
  }

  public static async deleteCustomer(customerId: string): Promise<void> {
    await SaltEdgeHelper.request('DELETE', `/customers/${customerId}`);
  }

  // ============================================================================
  // CONNECT SESSIONS — returns the widget URL the user opens in a WebView/browser
  // ============================================================================

  public static async createConnectSession(
    options: ConnectSessionOptions,
  ): Promise<ConnectSessionResponse> {
    const res = await SaltEdgeHelper.request<{ data: ConnectSessionResponse }>(
      'POST',
      '/connect_sessions/create',
      {
        data: {
          customer_id: options.customer_id,
          consent: {
            scopes: options.fetch_scopes ?? ['account_details', 'transactions_details'],
            from_date: options.from_date,
          },
          attempt: {
            fetch_scopes: options.fetch_scopes ?? ['accounts', 'transactions'],
            return_to: options.return_to,
            locale: options.locale ?? 'en',
            include_fake_providers: options.include_fake_providers ?? false,
            daily_refresh: options.daily_refresh ?? false,
            show_consent_confirmation: options.show_consent_confirmation ?? true,
          },
          ...(options.provider_code ? { provider_code: options.provider_code } : {}),
        },
      },
    );
    return res.data;
  }

  public static async createReconnectSession(
    options: ReconnectSessionOptions,
  ): Promise<ConnectSessionResponse> {
    const res = await SaltEdgeHelper.request<{ data: ConnectSessionResponse }>(
      'POST',
      '/connect_sessions/reconnect',
      {
        data: {
          connection_id: options.connection_id,
          customer_id: options.customer_id,
          attempt: {
            fetch_scopes: options.fetch_scopes ?? ['accounts', 'transactions'],
            return_to: options.return_to,
            locale: options.locale ?? 'en',
            from_date: options.from_date,
          },
        },
      },
    );
    return res.data;
  }

  public static async createRefreshSession(
    options: RefreshSessionOptions,
  ): Promise<ConnectSessionResponse> {
    const res = await SaltEdgeHelper.request<{ data: ConnectSessionResponse }>(
      'POST',
      '/connect_sessions/refresh',
      {
        data: {
          connection_id: options.connection_id,
          customer_id: options.customer_id,
          attempt: {
            fetch_scopes: options.fetch_scopes ?? ['accounts', 'transactions'],
            from_date: options.from_date,
          },
        },
      },
    );
    return res.data;
  }

  // ============================================================================
  // CONNECTIONS
  // ============================================================================

  public static async listConnections(
    params: ListConnectionsParams,
  ): Promise<PaginatedResponse<SaltEdgeConnection>> {
    const query: Record<string, string> = { customer_id: params.customer_id };
    if (params.from_id) query.from_id = params.from_id;

    return SaltEdgeHelper.request<PaginatedResponse<SaltEdgeConnection>>(
      'GET',
      '/connections',
      undefined,
      query,
    );
  }

  public static async getConnection(connectionId: string): Promise<SaltEdgeConnection> {
    const res = await SaltEdgeHelper.request<{ data: SaltEdgeConnection }>(
      'GET',
      `/connections/${connectionId}`,
    );
    return res.data;
  }

  public static async deleteConnection(connectionId: string): Promise<void> {
    await SaltEdgeHelper.request('DELETE', `/connections/${connectionId}`);
  }

  // ============================================================================
  // ACCOUNTS
  // ============================================================================

  public static async listAccounts(
    params: ListAccountsParams,
  ): Promise<PaginatedResponse<SaltEdgeAccount>> {
    const query: Record<string, string> = { connection_id: params.connection_id };
    if (params.customer_id) query.customer_id = params.customer_id;
    if (params.from_id) query.from_id = params.from_id;

    return SaltEdgeHelper.request<PaginatedResponse<SaltEdgeAccount>>(
      'GET',
      '/accounts',
      undefined,
      query,
    );
  }

  // ============================================================================
  // TRANSACTIONS
  // ============================================================================

  public static async listTransactions(
    params: ListTransactionsParams,
  ): Promise<PaginatedResponse<SaltEdgeTransaction>> {
    const query: Record<string, string> = { connection_id: params.connection_id };
    if (params.account_id) query.account_id = params.account_id;
    if (params.from_id) query.from_id = params.from_id;
    if (params.from_made_on) query.from_made_on = params.from_made_on;
    if (params.to_made_on) query.to_made_on = params.to_made_on;
    if (params.duplicated !== undefined) query.duplicated = String(params.duplicated);

    return SaltEdgeHelper.request<PaginatedResponse<SaltEdgeTransaction>>(
      'GET',
      '/transactions',
      undefined,
      query,
    );
  }

  public static async listPendingTransactions(
    params: Omit<ListTransactionsParams, 'duplicated'>,
  ): Promise<PaginatedResponse<SaltEdgeTransaction>> {
    const query: Record<string, string> = { connection_id: params.connection_id };
    if (params.account_id) query.account_id = params.account_id;
    if (params.from_id) query.from_id = params.from_id;
    if (params.from_made_on) query.from_made_on = params.from_made_on;
    if (params.to_made_on) query.to_made_on = params.to_made_on;

    return SaltEdgeHelper.request<PaginatedResponse<SaltEdgeTransaction>>(
      'GET',
      '/transactions/pending',
      undefined,
      query,
    );
  }

  /**
   * Fetch all pages of transactions — use carefully on large datasets
   */
  public static async listAllTransactions(
    params: ListTransactionsParams,
  ): Promise<SaltEdgeTransaction[]> {
    const all: SaltEdgeTransaction[] = [];
    let fromId: string | undefined = params.from_id;

    while (true) {
      const page = await SaltEdgeHelper.listTransactions({ ...params, from_id: fromId });
      all.push(...page.data);

      if (!page.meta.next_id) break;
      fromId = page.meta.next_id;
    }

    return all;
  }

  // ============================================================================
  // WEBHOOK VERIFICATION
  // ============================================================================

  /**
   * Verify the signature on a SaltEdge webhook payload.
   * SaltEdge signs the body with their private key; verify with their public key.
   * Store the public key PEM in SALTEDGE_PUBLIC_KEY env var.
   */
  public static verifyWebhookSignature(
    rawBody: string,
    signatureHeader: string,
    expiresAt: string,
  ): boolean {
    const publicKey = SaltEdgeHelper.saltEdgePublicKey;
    if (!publicKey) {
      console.warn('SALTEDGE_PUBLIC_KEY not set — skipping webhook signature verification');
      return false;
    }

    try {
      // SaltEdge v6 webhook signature: Base64(RSA-SHA256(expires_at + "|" + body))
      const payload = `${expiresAt}|${rawBody}`;
      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(payload);
      verify.end();
      return verify.verify(publicKey, signatureHeader, 'base64');
    } catch (error: any) {
      console.error('SaltEdge webhook signature verification failed:', error.message);
      return false;
    }
  }

  // ============================================================================
  // CONVENIENCE: FULL SYNC — fetch all accounts + transactions for a connection
  // ============================================================================

  public static async syncConnection(
    connectionId: string,
    fromDate?: string,
  ): Promise<{ accounts: SaltEdgeAccount[]; transactions: SaltEdgeTransaction[] }> {
    const [accountsPage, transactions] = await Promise.all([
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
  }
}
