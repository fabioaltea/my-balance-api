import { GoogleHelper } from '../google';
import { GoogleAuthHelper } from '../google/auth.helper';
import { DbHelper } from '../db.helper';
import { DeviceType } from '../../models';

export const LATEST_SCHEMA_VERSION = 3;

/**
 * Interfaccia per le migrazioni di schema
 */
interface Migration {
  fromVersion: number;
  toVersion: number;
  description: string;
  execute: (spreadsheetId: string, userEmail: string, deviceType: DeviceType) => Promise<void>;
}

/**
 * Mapping colonne v1 → v2 per AllTransactions.
 *
 * v1: desc(0) cat(1) amt(2) date(3) type(4) account(5) txId(6) mvId(7) notes(8) location(9) recId(10) dateAdded(11) dateMod(12) dateDel(13) status(14)
 * v2: desc(0) cat(1) amt(2) date(3) type(4) account(5) status(6) location(7) notes(8) txId(9) mvId(10) recId(11) recPattern(12) dateAdded(13) dateMod(14) dateDel(15)
 */
const V1_TO_V2_COL_MAP: Record<number, number> = {
  0: 0, // description → description
  1: 1, // category → category
  2: 2, // amount → amount
  3: 3, // date → date
  4: 4, // type → type
  5: 5, // account → account
  6: 9, // transactionId → transactionId (spostato)
  7: 10, // movementId → movementId (spostato)
  8: 8, // notes → notes
  9: 7, // location → location (spostato)
  10: 11, // recurrenceId → recurrenceId (spostato)
  11: 13, // dateAdded → dateAdded (spostato)
  12: 14, // dateModified → dateModified (spostato)
  13: 15, // dateDeleted → dateDeleted (spostato)
  14: 6, // status → status (spostato)
};

const V2_COL_COUNT = 16; // incluso recurrencePattern

const V2_HEADERS = [
  'description',
  'category',
  'amount',
  'date',
  'type',
  'account',
  'status',
  'location',
  'notes',
  'transactionId',
  'movementId',
  'recurrenceId',
  'recurrencePattern',
  'dateAdded',
  'dateModified',
  'dateDeleted',
];

const SHEET_NAME = 'AllTransactions';
const OLD_SHEET_NAME = 'AllTransactions_old';

/**
 * Trova lo sheetId numerico di un tab dal suo nome
 */
async function getSheetId(
  userEmail: string,
  deviceType: DeviceType,
  spreadsheetId: string,
  sheetName: string,
): Promise<number | null> {
  const sheetsMeta = await GoogleAuthHelper.executeWithRetry(
    userEmail,
    deviceType,
    async (client) => GoogleHelper.getSpreadsheetMeta(client, spreadsheetId),
  );
  const match = sheetsMeta.find((s: any) => s.properties?.title === sheetName);
  return match?.properties?.sheetId ?? null;
}

/**
 * Migrazione v1 → v2: riordino colonne AllTransactions
 *
 * Approccio sicuro:
 *  1. Se esiste già AllTransactions_old (tentativo precedente fallito), lo usa come sorgente
 *  2. Rinomina AllTransactions → AllTransactions_old
 *  3. Crea un nuovo tab AllTransactions
 *  4. Scrive header v2 + dati mappati nel nuovo tab
 *  (il tab _old rimane per sicurezza, lo si potrà eliminare manualmente)
 */
const migrationV1toV2: Migration = {
  fromVersion: 1,
  toVersion: 2,
  description: 'Riordino colonne AllTransactions + aggiunta recurrencePattern',
  execute: async (spreadsheetId: string, userEmail: string, deviceType: DeviceType) => {
    console.log('🔄 Executing migration v1 → v2 (rename+copy)');

    // --- Retry-safe: controlla se esiste già _old da un tentativo precedente ---
    const oldSheetId = await getSheetId(userEmail, deviceType, spreadsheetId, OLD_SHEET_NAME);
    const currentSheetId = await getSheetId(userEmail, deviceType, spreadsheetId, SHEET_NAME);

    let sourceSheetName: string;

    if (oldSheetId !== null && currentSheetId !== null) {
      // Entrambi esistono: il tentativo precedente ha già rinominato e creato il nuovo,
      // ma potrebbe non aver finito di copiare. Usiamo _old come sorgente
      // e cancelliamo il nuovo vuoto per ricrearlo
      console.log('⚠️ Found existing AllTransactions_old — resuming previous attempt');
      await GoogleAuthHelper.executeWithRetry(userEmail, deviceType, async (client) =>
        GoogleHelper.batchUpdateSpreadsheet(client, spreadsheetId, [
          { deleteSheet: { sheetId: currentSheetId } },
        ]),
      );
      sourceSheetName = OLD_SHEET_NAME;
    } else if (oldSheetId !== null && currentSheetId === null) {
      // Solo _old esiste (caso raro): usalo come sorgente
      console.log('⚠️ Only AllTransactions_old found — resuming');
      sourceSheetName = OLD_SHEET_NAME;
    } else if (currentSheetId === null) {
      throw new Error('AllTransactions sheet not found in spreadsheet');
    } else {
      // Caso normale: rinomina AllTransactions → AllTransactions_old
      console.log('🔄 Renaming AllTransactions → AllTransactions_old');
      await GoogleAuthHelper.executeWithRetry(userEmail, deviceType, async (client) =>
        GoogleHelper.batchUpdateSpreadsheet(client, spreadsheetId, [
          {
            updateSheetProperties: {
              properties: { sheetId: currentSheetId, title: OLD_SHEET_NAME },
              fields: 'title',
            },
          },
        ]),
      );
      sourceSheetName = OLD_SHEET_NAME;
    }

    // --- Crea nuovo tab AllTransactions ---
    console.log('🔄 Creating new AllTransactions sheet');
    await GoogleAuthHelper.executeWithRetry(userEmail, deviceType, async (client) =>
      GoogleHelper.batchUpdateSpreadsheet(client, spreadsheetId, [
        {
          addSheet: {
            properties: { title: SHEET_NAME, index: 0 },
          },
        },
      ]),
    );

    // --- Leggi dati dal vecchio tab ---
    let rows: any[][] | undefined;
    try {
      rows = await GoogleAuthHelper.executeWithRetry(userEmail, deviceType, async (client) =>
        GoogleHelper.get(client, spreadsheetId, `${sourceSheetName}!A1:Z`),
      );
    } catch {
      console.log('⚠️ Source sheet vuoto o non accessibile, skip dati');
      rows = undefined;
    }

    // --- Scrivi header v2 ---
    await GoogleAuthHelper.executeWithRetry(userEmail, deviceType, async (client) =>
      GoogleHelper.update(client, spreadsheetId, [
        { range: `${SHEET_NAME}!A1:P1`, values: [V2_HEADERS] },
      ]),
    );

    // --- Mappa e scrivi dati ---
    if (rows && rows.length > 0) {
      // Salta la prima riga se è un header
      const firstCell = String(rows[0][0] || '').toLowerCase();
      const dataRows = firstCell === 'description' ? rows.slice(1) : rows;

      if (dataRows.length > 0) {
        const migratedRows = dataRows.map((row) => {
          const newRow: any[] = new Array(V2_COL_COUNT).fill('');
          for (const [v1Idx, v2Idx] of Object.entries(V1_TO_V2_COL_MAP)) {
            const sourceIdx = parseInt(v1Idx);
            if (sourceIdx < row.length) {
              newRow[v2Idx] = row[sourceIdx] ?? '';
            }
          }
          return newRow;
        });

        // Scrivi dalla riga 2 (dopo gli header) usando update (non append)
        await GoogleAuthHelper.executeWithRetry(userEmail, deviceType, async (client) =>
          GoogleHelper.update(client, spreadsheetId, [
            {
              range: `${SHEET_NAME}!A2:P${migratedRows.length + 1}`,
              values: migratedRows,
            },
          ]),
        );

        console.log(`✅ Migrated ${migratedRows.length} data rows to new AllTransactions`);
      } else {
        console.log('ℹ️ No data rows to migrate (only header)');
      }
    } else {
      console.log('ℹ️ No data to migrate');
    }

    console.log('✅ Migration v1 → v2 completed (AllTransactions_old preserved)');
  },
};

/**
 * Helper generico per migrare un singolo sheet con rename+copy.
 * 1. Rinomina sheetName → sheetName_old (retry-safe)
 * 2. Crea nuovo sheetName
 * 3. Scrive headers
 * 4. Legge dati da _old, applica colMap, scrive nel nuovo
 */
async function migrateSheet(
  spreadsheetId: string,
  userEmail: string,
  deviceType: DeviceType,
  sheetName: string,
  newHeaders: string[],
  colMap: Record<number, number>,
  newColCount: number,
  headerDetectCell?: string,
) {
  const oldName = `${sheetName}_old`;
  const oldSheetId = await getSheetId(userEmail, deviceType, spreadsheetId, oldName);
  const currentSheetId = await getSheetId(userEmail, deviceType, spreadsheetId, sheetName);

  let sourceSheetName: string;

  if (oldSheetId !== null && currentSheetId !== null) {
    console.log(`⚠️ Found existing ${oldName} — resuming previous attempt`);
    await GoogleAuthHelper.executeWithRetry(userEmail, deviceType, async (client) =>
      GoogleHelper.batchUpdateSpreadsheet(client, spreadsheetId, [
        { deleteSheet: { sheetId: currentSheetId } },
      ]),
    );
    sourceSheetName = oldName;
  } else if (oldSheetId !== null && currentSheetId === null) {
    console.log(`⚠️ Only ${oldName} found — resuming`);
    sourceSheetName = oldName;
  } else if (currentSheetId === null) {
    throw new Error(`${sheetName} sheet not found in spreadsheet`);
  } else {
    console.log(`🔄 Renaming ${sheetName} → ${oldName}`);
    await GoogleAuthHelper.executeWithRetry(userEmail, deviceType, async (client) =>
      GoogleHelper.batchUpdateSpreadsheet(client, spreadsheetId, [
        {
          updateSheetProperties: {
            properties: { sheetId: currentSheetId, title: oldName },
            fields: 'title',
          },
        },
      ]),
    );
    sourceSheetName = oldName;
  }

  console.log(`🔄 Creating new ${sheetName} sheet`);
  await GoogleAuthHelper.executeWithRetry(userEmail, deviceType, async (client) =>
    GoogleHelper.batchUpdateSpreadsheet(client, spreadsheetId, [
      { addSheet: { properties: { title: sheetName } } },
    ]),
  );

  const lastCol = String.fromCharCode(64 + newHeaders.length); // A=65, so 6 cols → F
  await GoogleAuthHelper.executeWithRetry(userEmail, deviceType, async (client) =>
    GoogleHelper.update(client, spreadsheetId, [
      { range: `${sheetName}!A1:${lastCol}1`, values: [newHeaders] },
    ]),
  );

  let rows: any[][] | undefined;
  try {
    rows = await GoogleAuthHelper.executeWithRetry(userEmail, deviceType, async (client) =>
      GoogleHelper.get(client, spreadsheetId, `${sourceSheetName}!A1:Z`),
    );
  } catch {
    console.log(`⚠️ ${sourceSheetName} vuoto o non accessibile, skip dati`);
    rows = undefined;
  }

  if (rows && rows.length > 0) {
    const detect = headerDetectCell || String(newHeaders[0]).toLowerCase();
    const firstCell = String(rows[0][0] || '').toLowerCase();
    const dataRows = firstCell === detect ? rows.slice(1) : rows;

    if (dataRows.length > 0) {
      const migratedRows = dataRows.map((row) => {
        const newRow: any[] = new Array(newColCount).fill('');
        for (const [srcIdx, dstIdx] of Object.entries(colMap)) {
          const s = parseInt(srcIdx);
          if (s < row.length) {
            newRow[dstIdx] = row[s] ?? '';
          }
        }
        return newRow;
      });

      await GoogleAuthHelper.executeWithRetry(userEmail, deviceType, async (client) =>
        GoogleHelper.update(client, spreadsheetId, [
          {
            range: `${sheetName}!A2:${lastCol}${migratedRows.length + 1}`,
            values: migratedRows,
          },
        ]),
      );

      console.log(`✅ Migrated ${migratedRows.length} data rows to new ${sheetName}`);
    }
  }
}

// =====================
// Migrazione v2 → v3
// =====================

/**
 * Accounts v2→v3:
 * v2: accountName(0) startBalance(1) curBalance(2) color(3) txtColor(4) imgUrl(5) isTotal(6)
 * v3: accountName(0) accountColor(1) accountTxtColor(2) accountImgUrl(3) dateAdded(4) dateModified(5)
 */
const ACCOUNTS_V2_TO_V3_COL_MAP: Record<number, number> = {
  0: 0, // accountName → accountName
  3: 1, // accountColor → accountColor
  4: 2, // accountTxtColor → accountTxtColor
  5: 3, // accountImgUrl → accountImgUrl
  // startBalance(1), curBalance(2), isTotal(6) → removed
  // dateAdded(4), dateModified(5) → new, default ""
};
const ACCOUNTS_V3_HEADERS = [
  'accountName',
  'accountColor',
  'accountTxtColor',
  'accountImgUrl',
  'dateAdded',
  'dateModified',
];
const ACCOUNTS_V3_COL_COUNT = 6;

/**
 * Categories v2→v3:
 * v2: categoryName(0) categoryType(1) categoryColor(2) categoryIconUrl(3)
 * v3: categoryName(0) categoryColor(1) categoryIconUrl(2) dateAdded(3) dateModified(4)
 */
const CATEGORIES_V2_TO_V3_COL_MAP: Record<number, number> = {
  0: 0, // categoryName → categoryName
  // 1: categoryType → removed
  2: 1, // categoryColor → categoryColor
  3: 2, // categoryIconUrl → categoryIconUrl
  // dateAdded(3), dateModified(4) → new, default ""
};
const CATEGORIES_V3_HEADERS = [
  'categoryName',
  'categoryColor',
  'categoryIconUrl',
  'dateAdded',
  'dateModified',
];
const CATEGORIES_V3_COL_COUNT = 5;

const migrationV2toV3: Migration = {
  fromVersion: 2,
  toVersion: 3,
  description:
    'Accounts: rimozione balance/isTotal + dateAdded/dateModified. Categories: rimozione type + dateAdded/dateModified',
  execute: async (spreadsheetId, userEmail, deviceType) => {
    console.log('🔄 Executing migration v2 → v3 (rename+copy)');

    // Migra Accounts
    await migrateSheet(
      spreadsheetId,
      userEmail,
      deviceType,
      'Accounts',
      ACCOUNTS_V3_HEADERS,
      ACCOUNTS_V2_TO_V3_COL_MAP,
      ACCOUNTS_V3_COL_COUNT,
      'accountname',
    );

    // Migra Categories
    await migrateSheet(
      spreadsheetId,
      userEmail,
      deviceType,
      'Categories',
      CATEGORIES_V3_HEADERS,
      CATEGORIES_V2_TO_V3_COL_MAP,
      CATEGORIES_V3_COL_COUNT,
      'categoryname',
    );

    console.log('✅ Migration v2 → v3 completed');
  },
};

/**
 * Registry delle migrazioni disponibili, ordinate per versione
 */
const MIGRATIONS: Migration[] = [migrationV1toV2, migrationV2toV3];

/**
 * Helper per la gestione delle migrazioni di schema
 */
export class MigrationHelper {
  /**
   * Esegue tutte le migrazioni pendenti per un utente
   * @returns La nuova schema_version dopo le migrazioni
   */
  static async executePendingMigrations(
    userEmail: string,
    deviceType: DeviceType,
  ): Promise<{ fromVersion: number; toVersion: number; migrationsRun: number }> {
    // Leggi user_products per schema_version e spreadsheet_id
    const userProduct = await DbHelper.getUserProduct(userEmail);
    const currentVersion = userProduct?.schema_version ?? 1;

    if (currentVersion >= LATEST_SCHEMA_VERSION) {
      console.log(`✅ Schema already at v${currentVersion}, no migration needed`);
      return {
        fromVersion: currentVersion,
        toVersion: currentVersion,
        migrationsRun: 0,
      };
    }

    const spreadsheetId = userProduct?.spreadsheet_id;
    if (!spreadsheetId) {
      throw new Error('No spreadsheet configured for user in user_products');
    }

    console.log(
      `🔄 Migrating schema v${currentVersion} → v${LATEST_SCHEMA_VERSION} for ${userEmail}`,
    );

    // Esegui le migrazioni in ordine
    let version = currentVersion;
    let migrationsRun = 0;

    for (const migration of MIGRATIONS) {
      if (migration.fromVersion === version) {
        console.log(
          `🔄 Running migration: ${migration.description} (v${migration.fromVersion} → v${migration.toVersion})`,
        );
        await migration.execute(spreadsheetId, userEmail, deviceType);
        version = migration.toVersion;
        migrationsRun++;

        // Aggiorna la versione nel DB dopo ogni migrazione
        await DbHelper.updateSchemaVersion(userEmail, version);
        console.log(`✅ Schema version updated to v${version}`);
      }
    }

    return {
      fromVersion: currentVersion,
      toVersion: version,
      migrationsRun,
    };
  }
}
