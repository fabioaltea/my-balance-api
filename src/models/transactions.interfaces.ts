// MyBalance domain interfaces - Transactions and Movements

// Rappresenta una singola transaction (riga nel foglio AllTransactions)
export interface ITransaction {
  description: string; // Descrizione della transazione
  category: string; // Categoria (es. FOOD, RENT ...)
  amount: string; // Importo come stringa (così come appare in Google Sheets)
  date: string; // Data della transazione (dd-MM-yyyy)
  type?: string; // Tipologia (in | out)
  account?: string; // Account di riferimento
  transactionId: string; // Id univoco della transazione (chiave primaria)
  movementId: string; // Id del movimento di appartenenza (raggruppa transactions)
  notes?: string; // Note libere
  location?: string; // Luogo / wallet
  recurrenceId?: string; // Id per transazioni ricorrenti
  recurrencePattern?: string; // ISO 8601 duration format (e.g., P1W, P1M)
  dateAdded: string; // Data di inserimento (dd-MM-yyyy hh:mm)
  dateModified?: string; // Ultima modifica (dd-MM-yyyy hh:mm)
  dateDeleted?: string; // Data cancellazione (dd-MM-yyyy hh:mm) se DELETED
  status?: string; // Stato (ACTIVE | DELETED | recurrent ...)
}

// Rappresenta un movimento logico (insieme di transactions con stesso movementId)
export interface IMovement {
  movementId: string; // Id univoco del movimento
  description: string; // Descrizione principale (da prima transaction)
  category: string; // Categoria (da prima transaction)
  date: string; // Data (da prima transaction)
  type?: string; // Tipo principale (da prima transaction)
  location?: string; // Location (da prima transaction)
  notes?: string; // Note (da prima transaction)
  recurrenceId?: string; // Ricorrenza (da prima transaction)
  recurrencePattern?: string; // ISO 8601 duration format (e.g., P1W, P1M)
  status?: string; // Status (da prima transaction)
  transactions: ITransaction[]; // Array delle transactions che compongono il movimento
  transactionsSum: number; // Somma degli importi delle transactions
}

// Struttura restituita da list/get convertendo da Google Sheets
export interface ITransactionRowParseResult {
  rowIndex: number; // Indice (1-based) della riga nel foglio
  transaction: ITransaction; // Oggetto transaction
}

// Body per append (valori già convertiti in array)
export interface IAppendTransactionBody {
  values: any[][]; // Ogni riga rappresenta una transaction convertita
}

// Body per update batch (Google batchUpdate -> data[])
export interface IUpdateTransactionBodyData {
  majorDimension: "ROWS";
  range: string; // Es: AllTransactions!A10:Z10
  values: any[][]; // Singola riga aggiornata
}

// Request body per creare/aggiornare un movement
export interface IMovementRequest {
  movementId?: string; // Se presente, è un update
  description: string;
  category: string;
  date: string;
  type?: string;
  location?: string;
  notes?: string;
  recurrenceId?: string;
  recurrencePattern?: string; // ISO 8601 duration format (e.g., P1W, P1M)
  status?: string; // Status (recurrent for recurring templates)
  transactions: ITransactionRequest[]; // Le transactions da creare/aggiornare
}

export interface IMovementBatchUpdateItem {
  movementId: string;
  location?: string;
}

export interface IMovementBatchUpdateRequest {
  movements: IMovementBatchUpdateItem[];
}

// Request body per una singola transaction
export interface ITransactionRequest {
  transactionId?: string; // Se presente, è un update
  description?: string; // Se omesso, eredita dal movement
  category?: string; // Se omesso, eredita dal movement
  amount: string; // Importo come stringa (per consistenza con Google Sheets)
  date?: string; // Se omesso, eredita dal movement
  type?: string; // Se omesso, eredita dal movement
  account?: string;
  notes?: string; // Se omesso, eredita dal movement
  location?: string; // Se omesso, eredita dal movement
  _operation?: "create" | "update" | "delete"; // Operazione da eseguire
}
