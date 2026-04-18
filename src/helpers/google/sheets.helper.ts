import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import { IGetBody } from '../../models';
import { template } from '../../assets/template';

dotenv.config({ path: '.env.local' });

function createGoogleSheetsError(message: string, error: any): Error {
  const wrappedError = new Error(`${message}. Error: ${error?.message || String(error)}`);

  Object.assign(wrappedError, {
    code: error?.code,
    status: error?.status,
    response: error?.response,
    errors: error?.errors,
    cause: error,
  });

  return wrappedError;
}

export class GoogleHelper {
  public static async get(auth: any, spreadsheetId: string, range: string) {
    if (!spreadsheetId && !range) {
      throw new Error('Missing or invalid parameters: spreadsheetId, range');
    }
    if (!spreadsheetId || spreadsheetId == '') {
      throw new Error('Missing or invalid parameter: spreadsheetId');
    }
    if (!range || range == '') {
      throw new Error('Missing or invalid parameter: range');
    }

    try {
      const sheets = google.sheets({ version: 'v4', auth });
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: range,
      } as IGetBody);
      const rows = res.data.values;
      if (!rows || rows.length === 0) {
        console.log('No data found.');
        return;
      }

      return rows;
    } catch (error) {
      console.error('Error fetching items:', error);
      throw createGoogleSheetsError('Failed to fetch items from Google Sheets', error);
    }
  }

  public static async update(auth: any, spreadsheetId: string, body: any) {
    if (!spreadsheetId && !body) {
      throw new Error('Missing or invalid parameters: spreadsheetId, range');
    }
    if (!spreadsheetId || spreadsheetId == '') {
      throw new Error('Missing or invalid parameter: spreadsheetId');
    }
    if (!body) {
      throw new Error('Missing or invalid parameter: body');
    }

    try {
      const sheets = google.sheets({ version: 'v4', auth });
      const res = await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: spreadsheetId,
        requestBody: {
          valueInputOption: 'RAW',
          data: body,
        },
      });

      if (res.status) {
        return res;
      } else {
        throw new Error();
      }
    } catch (error) {
      console.error('Error fetching items:', error);
      throw createGoogleSheetsError('Failed to fetch items from Google Sheets', error);
    }
  }

  public static async append(auth: any, spreadsheetId: string, range: string, body: any) {
    if (!spreadsheetId && !body) {
      throw new Error('Missing or invalid parameters: spreadsheetId, range');
    }
    if (!spreadsheetId || spreadsheetId == '') {
      throw new Error('Missing or invalid parameter: spreadsheetId');
    }
    if (!body) {
      throw new Error('Missing or invalid parameter: range');
    }

    try {
      const sheets = google.sheets({ version: 'v4', auth });
      const res = await sheets.spreadsheets.values.append({
        spreadsheetId: spreadsheetId,
        requestBody: body,
        range: range,
        valueInputOption: 'RAW',
      });

      if (res.status) {
        return res;
      } else {
        throw new Error();
      }
    } catch (error) {
      console.error('Error fetching items:', error);
      throw createGoogleSheetsError('Failed to fetch items from Google Sheets', error);
    }
  }

  /**
   * Esegue operazioni strutturali sullo spreadsheet (rinomina sheet, aggiungi sheet, ecc.)
   * Usa spreadsheets.batchUpdate (NON values.batchUpdate)
   */
  public static async batchUpdateSpreadsheet(auth: any, spreadsheetId: string, requests: any[]) {
    if (!spreadsheetId) {
      throw new Error('Missing or invalid parameter: spreadsheetId');
    }
    if (!requests || requests.length === 0) {
      throw new Error('Missing or invalid parameter: requests');
    }

    try {
      const sheets = google.sheets({ version: 'v4', auth });
      const res = await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests },
      });
      return res;
    } catch (error) {
      console.error('Error in batchUpdateSpreadsheet:', error);
      throw createGoogleSheetsError('Failed batchUpdate on spreadsheet', error);
    }
  }

  /**
   * Ottiene i metadati dello spreadsheet (inclusi sheetId per ogni tab)
   */
  public static async getSpreadsheetMeta(auth: any, spreadsheetId: string) {
    if (!spreadsheetId) {
      throw new Error('Missing or invalid parameter: spreadsheetId');
    }

    try {
      const sheets = google.sheets({ version: 'v4', auth });
      const res = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets.properties',
      });
      return res.data.sheets || [];
    } catch (error) {
      console.error('Error getting spreadsheet meta:', error);
      throw createGoogleSheetsError('Failed to get spreadsheet metadata', error);
    }
  }

  public static async create(auth: any, userEmail: any) {
    if (!userEmail) {
      throw new Error('Missing or invalid parameter: userEmail');
    }

    try {
      const sheets = google.sheets({ version: 'v4', auth });
      const res = await sheets.spreadsheets.create({
        requestBody: template,
      });
      return res;
    } catch (error) {
      console.error('Error fetching items:', error);
      throw createGoogleSheetsError('Failed to fetch items from Google Sheets', error);
    }
  }
}
