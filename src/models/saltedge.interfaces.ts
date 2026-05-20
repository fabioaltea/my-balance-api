// SaltEdge Account Information API v6

// ============================================================================
// CORE ENTITIES
// ============================================================================

export interface SaltEdgeCustomer {
  id: string;
  identifier: string;
  created_at: string;
}

export interface SaltEdgeConnection {
  id: string;
  secret: string;
  provider_id: string;
  provider_code: string;
  provider_name: string;
  customer_id: string;
  created_at: string;
  updated_at: string;
  last_success_at: string | null;
  status: 'active' | 'inactive' | 'disabled';
  categorized: boolean;
  daily_refresh: boolean;
  store_credentials: boolean;
  country_code: string;
  last_attempt: SaltEdgeAttempt | null;
}

export interface SaltEdgeAttempt {
  api_mode: string;
  api_version: string;
  automatic_fetch: boolean;
  daily_refresh: boolean;
  categorize: boolean;
  created_at: string;
  customer_last_logged_at: string | null;
  fail_at: string | null;
  fail_error_class: string | null;
  fail_message: string | null;
  fetch_scopes: string[];
  finished: boolean;
  finished_recent: boolean;
  from_date: string | null;
  id: string;
  interactive: boolean;
  locale: string;
  partial: boolean;
  store_credentials: boolean;
  success_at: string | null;
  to_date: string | null;
  show_consent_confirmation: boolean;
  include_natures: string[] | null;
}

export interface SaltEdgeAccount {
  id: string;
  name: string;
  nature:
    | 'account'
    | 'card'
    | 'savings'
    | 'checking'
    | 'credit'
    | 'debit'
    | 'investment'
    | 'loan'
    | 'mortgage'
    | string;
  balance: number;
  currency_code: string;
  connection_id: string;
  created_at: string;
  updated_at: string;
  extra: SaltEdgeAccountExtra;
}

export interface SaltEdgeAccountExtra {
  iban?: string;
  bic?: string;
  account_name?: string;
  account_number?: string;
  client_name?: string;
  credit_limit?: number;
  available_amount?: number;
  assets?: string[];
  cards?: string[];
  blocked_amount?: number;
  current_date?: string;
  current_time?: string;
  transactions_count?: { posted: number; pending: number };
  [key: string]: unknown;
}

export interface SaltEdgeTransaction {
  id: string;
  duplicated: boolean;
  mode: 'normal' | 'fee' | 'transfer';
  status: 'posted' | 'pending';
  made_on: string;
  amount: number;
  currency_code: string;
  description: string;
  category: string;
  account_id: string;
  created_at: string;
  updated_at: string;
  extra: SaltEdgeTransactionExtra;
}

export interface SaltEdgeTransactionExtra {
  id?: string;
  posting_date?: string;
  account_balance_snapshot?: number;
  categorization_confidence?: number;
  original_amount?: number;
  original_currency_code?: string;
  original_category?: string;
  merchant_id?: string;
  payee?: string;
  payer?: string;
  payee_information?: string;
  payer_information?: string;
  transfer_account_name?: string;
  [key: string]: unknown;
}

// ============================================================================
// CONNECT SESSION
// ============================================================================

export interface ConnectSessionOptions {
  /** SaltEdge customer_id */
  customer_id: string;
  /** Scopes to fetch: 'account_details', 'transactions_details', 'holder_info' */
  fetch_scopes?: string[];
  /** ISO 8601 date string to fetch transactions from */
  from_date?: string;
  /** Redirect URL after widget completion */
  return_to?: string;
  /** Locale for the widget (e.g. 'en', 'it') */
  locale?: string;
  /** If true, include pending transactions */
  include_fake_providers?: boolean;
  /** ISO country code to pre-filter providers */
  provider_code?: string;
  /** Whether to show consent confirmation step */
  show_consent_confirmation?: boolean;
  /** Override daily_refresh for this connection */
  daily_refresh?: boolean;
}

export interface ReconnectSessionOptions {
  connection_id: string;
  customer_id: string;
  return_to?: string;
  locale?: string;
  fetch_scopes?: string[];
  from_date?: string;
}

export interface RefreshSessionOptions {
  connection_id: string;
  customer_id: string;
  fetch_scopes?: string[];
  from_date?: string;
}

export interface ConnectSessionResponse {
  expires_at: string;
  connect_url: string;
}

// ============================================================================
// LIST PARAMS
// ============================================================================

export interface ListConnectionsParams {
  customer_id: string;
  from_id?: string;
}

export interface ListAccountsParams {
  connection_id: string;
  customer_id?: string;
  from_id?: string;
}

export interface ListTransactionsParams {
  connection_id: string;
  account_id?: string;
  from_id?: string;
  from_made_on?: string;
  to_made_on?: string;
  duplicated?: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    next_id: string | null;
    next_page: string | null;
  };
}

// ============================================================================
// DB RECORDS (stored in PostgreSQL)
// ============================================================================

export interface SaltEdgeCustomerRecord {
  user_email: string;
  saltedge_customer_id: string;
  created_at: string;
}

export interface SaltEdgeConnectionRecord {
  id: string;
  user_email: string;
  saltedge_connection_id: string;
  /** mybalance account ID (row index or UUID) this connection maps to */
  account_id: string | null;
  provider_name: string;
  status: string;
  last_synced_at: string | null;
  created_at: string;
}
