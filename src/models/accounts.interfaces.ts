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
}

export interface IAccountData {
  name: string;
  description?: string;
  balance?: string;
  color?: string;
  textColor?: string;
}
