// Spreadsheets helper interfaces

export interface ISpreadsheetValidation {
  valid: boolean;
  issues: string[];
}

export interface ITemplateData {
  sheets: Array<{
    name: string;
    headers: string[];
  }>;
  defaultCategories: any[];
  defaultAccounts: any[];
}
