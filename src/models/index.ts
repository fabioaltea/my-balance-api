// Barrel export for all models/interfaces

// Google Sheets API
export type {
  IGetBody,
  IUpdateBody,
  IUpdateBodyData,
  IAppendBody,
} from "./sheets.interfaces";

// Transactions and Movements
export type {
  ITransaction,
  IMovement,
  ITransactionRowParseResult,
  IAppendTransactionBody,
  IUpdateTransactionBodyData,
  IMovementRequest,
  ITransactionRequest,
} from "./transactions.interfaces";

// Google OAuth
export type {
  GoogleTokens,
  GoogleIdentity,
  ExchangeCodeParams,
  DeviceType,
} from "./google.interfaces";

// Authentication
export type {
  JwtPayload,
  AccessTokenPayload,
  RefreshTokenData,
  AuthenticatedRequest,
  GoogleCallbackRequest,
  RefreshRequest,
  PasskeyLoginRequest,
  LogoutRequest,
} from "./auth.interfaces";

// Database
export type {
  CreateUserRequest,
  UpdateUserRequest,
  CreateSessionRequest,
  UpdateSessionRequest,
} from "./db.interfaces";

// Accounts
export type { IAccount, IAccountData } from "./accounts.interfaces";

// Categories
export type { ICategory, ICategoryData } from "./categories.interfaces";

// Spreadsheets
export type {
  ISpreadsheetValidation,
  ITemplateData,
} from "./spreadsheets.interfaces";
