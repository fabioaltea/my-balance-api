import crypto from 'crypto';

export class ChatGptApiError extends Error {
  constructor(
    public code: string,
    public status = 502,
    public providerStatus?: number,
    public requestId?: string,
  ) {
    super(code);
  }
}
export interface ChatGptAccess {
  connectionId: string;
  accessToken: string;
  expiresAt: string;
}

export class ChatGptAuthHelper {
  static async accessToken(
    authorization: string,
    connectionId?: string,
    signal?: AbortSignal,
  ): Promise<ChatGptAccess> {
    const secret = process.env.CHATGPT_SERVICE_SECRET || '';
    if (secret.length < 32) throw new ChatGptApiError('CHATGPT_NOT_CONFIGURED', 503);
    const path = '/internal/integrations/chatgpt/access-token';
    const body = JSON.stringify(connectionId ? { connectionId } : {});
    const timestamp = Date.now().toString();
    const requestId = crypto.randomUUID();
    const hash = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
    const canonical = [timestamp, requestId, 'POST', path, hash(body), hash(authorization)].join(
      '\n',
    );
    try {
      const response = await fetch(
        `${process.env.AUTH_SERVICE_URL || 'http://localhost:8082'}${path}`,
        {
          method: 'POST',
          redirect: 'error',
          body,
          signal: signal
            ? AbortSignal.any([signal, AbortSignal.timeout(30000)])
            : AbortSignal.timeout(30000),
          headers: {
            'Content-Type': 'application/json',
            Authorization: authorization,
            'x-chatgpt-timestamp': timestamp,
            'x-chatgpt-request-id': requestId,
            'x-chatgpt-signature': crypto
              .createHmac('sha256', secret)
              .update(canonical)
              .digest('hex'),
          },
        },
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        const code =
          typeof result.code === 'string' && /^CHATGPT_[A-Z_]+$/.test(result.code)
            ? result.code
            : 'CHATGPT_AUTH_UNAVAILABLE';
        throw new ChatGptApiError(code, response.status === 401 ? 409 : response.status);
      }
      const data = result.data;
      if (
        !data ||
        typeof data.accessToken !== 'string' ||
        !data.accessToken ||
        typeof data.connectionId !== 'string' ||
        !Number.isFinite(Date.parse(data.expiresAt)) ||
        Date.parse(data.expiresAt) <= Date.now() ||
        (connectionId && data.connectionId !== connectionId)
      )
        throw new ChatGptApiError('CHATGPT_AUTH_UNAVAILABLE', 502);
      return {
        connectionId: data.connectionId,
        accessToken: data.accessToken,
        expiresAt: data.expiresAt,
      };
    } catch (error) {
      if (error instanceof ChatGptApiError) throw error;
      throw new ChatGptApiError('CHATGPT_AUTH_UNAVAILABLE', 503);
    }
  }
}
