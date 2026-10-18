import { ChatGptApiError } from './chatgpt-auth.helper';

export interface ChatGptModel {
  slug: string;
  displayName: string;
}
const knownCodes: Record<string, [string, number]> = {
  subscription_sharing_usage_limit_exceeded: ['CHATGPT_USAGE_LIMIT', 429],
  subscription_sharing_usage_unavailable: ['CHATGPT_USAGE_UNAVAILABLE', 503],
  subscription_sharing_user_unavailable: ['CHATGPT_USAGE_UNAVAILABLE', 503],
  subscription_sharing_user_not_eligible: ['CHATGPT_NOT_ELIGIBLE', 403],
  subscription_sharing_invalid_user: ['CHATGPT_REAUTH_REQUIRED', 409],
  subscription_sharing_unsupported_capability: ['CHATGPT_UNSUPPORTED_CAPABILITY', 400],
  subscription_sharing_route_not_supported: ['CHATGPT_ROUTE_NOT_SUPPORTED', 403],
  chatpass_v2_scope_not_authorized: ['CHATGPT_PERMISSION_REQUIRED', 403],
  chatpass_v2_invalid_authorization_context: ['CHATGPT_PERMISSION_REQUIRED', 403],
};

export function chatGptProviderError(code: unknown, status: number, requestId?: string) {
  const mapped = typeof code === 'string' ? knownCodes[code] : undefined;
  const fallback: [string, number] =
    status === 401
      ? ['CHATGPT_REAUTH_REQUIRED', 409]
      : status === 429
        ? ['CHATGPT_USAGE_LIMIT', 429]
        : status === 403
          ? ['CHATGPT_PERMISSION_REQUIRED', 403]
          : ['CHATGPT_PROVIDER_UNAVAILABLE', 502];
  const [publicCode, publicStatus] = mapped || fallback;
  return new ChatGptApiError(publicCode, publicStatus, status, requestId);
}

/** A delta is provisional: consume the terminal event before reporting success. */
export async function readChatGptStream(body: ReadableStream<Uint8Array>, requestId?: string) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '',
    outputText = '',
    bytes = 0,
    completed = false;
  const consume = (frame: string) => {
    const data = frame
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');
    if (!data || data === '[DONE]') return;
    let event: any;
    try {
      event = JSON.parse(data);
    } catch {
      throw new ChatGptApiError('CHATGPT_INVALID_RESPONSE', 502);
    }
    if (event.type === 'response.failed' || event.type === 'error')
      throw chatGptProviderError(
        event.response?.error?.code || event.error?.code || event.code,
        200,
        requestId,
      );
    if (event.type === 'response.incomplete')
      throw new ChatGptApiError('CHATGPT_RESPONSE_INCOMPLETE', 502);
    if (event.type === 'response.output_text.delta') {
      if (typeof event.delta !== 'string')
        throw new ChatGptApiError('CHATGPT_INVALID_RESPONSE', 502);
      outputText += event.delta;
      if (outputText.length > 64000) throw new ChatGptApiError('CHATGPT_RESPONSE_TOO_LARGE', 502);
    }
    if (event.type === 'response.completed') {
      if (event.response?.status && event.response.status !== 'completed')
        throw new ChatGptApiError('CHATGPT_INVALID_RESPONSE', 502);
      completed = true;
      if (!outputText && Array.isArray(event.response?.output)) {
        outputText = event.response.output
          .flatMap((item: any) => item.content || [])
          .filter((item: any) => item.type === 'output_text' && typeof item.text === 'string')
          .map((item: any) => item.text)
          .join('');
      }
      if (outputText.length > 64000) throw new ChatGptApiError('CHATGPT_RESPONSE_TOO_LARGE', 502);
    }
  };
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 2 * 1024 * 1024) throw new ChatGptApiError('CHATGPT_RESPONSE_TOO_LARGE', 502);
      buffer += decoder.decode(chunk.value, { stream: true });
      let match: RegExpExecArray | null;
      while ((match = /\r?\n\r?\n/.exec(buffer))) {
        consume(buffer.slice(0, match.index));
        buffer = buffer.slice(match.index + match[0].length);
      }
      if (buffer.length > 512000) throw new ChatGptApiError('CHATGPT_RESPONSE_TOO_LARGE', 502);
      if (completed) return outputText;
    }
    buffer += decoder.decode();
    if (buffer.trim()) consume(buffer);
    if (!completed) throw new ChatGptApiError('CHATGPT_STREAM_INTERRUPTED', 502);
    return outputText;
  } finally {
    await reader.cancel().catch((): void => {});
    reader.releaseLock();
  }
}

export class ChatGptInferenceHelper {
  private static async request(
    path: '/models' | '/responses',
    token: string,
    signal?: AbortSignal,
    payload?: object,
  ) {
    try {
      const response = await fetch(`https://api.openai.com/v1${path}`, {
        method: payload ? 'POST' : 'GET',
        redirect: 'error',
        headers: {
          Authorization: `Bearer ${token}`,
          ...(payload ? { 'Content-Type': 'application/json', Accept: 'text/event-stream' } : {}),
        },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(payload ? 90000 : 10000)])
          : AbortSignal.timeout(payload ? 90000 : 10000),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw chatGptProviderError(
          data.error?.code,
          response.status,
          response.headers.get('x-request-id') || undefined,
        );
      }
      return response;
    } catch (error) {
      if (error instanceof ChatGptApiError) throw error;
      throw new ChatGptApiError('CHATGPT_PROVIDER_UNAVAILABLE', 503);
    }
  }

  static async models(token: string, signal?: AbortSignal): Promise<ChatGptModel[]> {
    const response = await this.request('/models', token, signal);
    const data = await response.json();
    if (!Array.isArray(data.models))
      throw new ChatGptApiError('CHATGPT_INVALID_MODEL_CATALOG', 502);
    return data.models
      .filter(
        (model: any) =>
          model.visibility === 'list' &&
          typeof model.slug === 'string' &&
          typeof model.display_name === 'string',
      )
      .map((model: any) => ({ slug: model.slug, displayName: model.display_name }));
  }

  static async respond(token: string, model: string, prompt: string, signal?: AbortSignal) {
    const models = await this.models(token, signal);
    if (!models.some((item) => item.slug === model))
      throw new ChatGptApiError('CHATGPT_MODEL_UNAVAILABLE', 400);
    const response = await this.request('/responses', token, signal, {
      model,
      input: [{ role: 'user', content: prompt }],
      store: false,
      stream: true,
    });
    if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream'))
      throw new ChatGptApiError('CHATGPT_INVALID_RESPONSE', 502);
    try {
      return await readChatGptStream(
        response.body,
        response.headers.get('x-request-id') || undefined,
      );
    } catch (error) {
      if (error instanceof ChatGptApiError) throw error;
      throw new ChatGptApiError('CHATGPT_STREAM_INTERRUPTED', 502);
    }
  }
}
