// Accounts interfaces

export interface IAccount {
  accountId: string;
  name: string;
  description: string;
  balance: string;
  color: string;
  textColor: string;
  status: string;
  dateAdded?: string;
  dateDeleted?: string;
  // SaltEdge integration — stored in sheet columns G/H/I
  saltedgeConnectionId?: string;
  saltedgeAccountId?: string;
  lastSyncedAt?: string;
}

export interface IAccountData {
  name: string;
  description?: string;
  balance?: string;
  color?: string;
  textColor?: string;
  // SaltEdge linking — set via dedicated linkSaltEdge method or passed on create
  saltedgeConnectionId?: string;
  saltedgeAccountId?: string;
}
