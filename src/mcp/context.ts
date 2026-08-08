import type { AuthInfo } from '@modelcontextprotocol/server';
import { GoogleAuthHelper } from '../helpers/google';
import { McpApplicationError } from './errors';

export type McpDeviceType = 'web' | 'ios' | 'android';

export interface McpPrincipal {
  userId: string;
  scopes: string[];
  deviceType: McpDeviceType;
  deviceId?: string;
}

export function getMcpPrincipal(authInfo?: AuthInfo): McpPrincipal {
  const userId = authInfo?.extra?.userId;
  const deviceType = authInfo?.extra?.deviceType;
  const deviceId = authInfo?.extra?.deviceId;

  if (typeof userId !== 'string' || !userId) {
    throw new McpApplicationError('AUTH_REQUIRED', 'Authenticated user context is missing');
  }

  return {
    userId,
    scopes: authInfo?.scopes || [],
    deviceType:
      deviceType === 'ios' || deviceType === 'android' || deviceType === 'web' ? deviceType : 'web',
    deviceId: typeof deviceId === 'string' ? deviceId : undefined,
  };
}

export async function withDefaultSpreadsheet<T>(
  principal: McpPrincipal,
  operation: (authClient: any, spreadsheetId: string) => Promise<T>,
): Promise<T> {
  const spreadsheetId = await GoogleAuthHelper.getSpreadsheetIdForUser(principal.userId);

  if (!spreadsheetId) {
    throw new McpApplicationError(
      'SPREADSHEET_NOT_CONFIGURED',
      'No default spreadsheet is configured for this user',
    );
  }

  return GoogleAuthHelper.executeWithRetry(
    principal.userId,
    principal.deviceType,
    async (authClient) => operation(authClient, spreadsheetId),
  );
}
