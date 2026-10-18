const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { ReadableStream } = require('node:stream/web');
const { TextDecoder, TextEncoder } = require('node:util');
const crypto = require('node:crypto');
const { load } = require('./load-ts.cjs');
const authPath = path.join(__dirname, '../src/helpers/chatgpt-auth.helper.ts');
const inferencePath = path.join(__dirname, '../src/helpers/chatgpt-inference.helper.ts');
const auth = load(authPath);
const loadInference = (fetch) =>
  load(inferencePath, { './chatgpt-auth.helper': auth }, { fetch, ReadableStream, TextDecoder });
function stream(events, chunkSize = 7) {
  const encoded = new TextEncoder().encode(
    events.map((event) => `data: ${JSON.stringify(event)}\r\n\r\n`).join(''),
  );
  return new ReadableStream({
    start(controller) {
      for (let i = 0; i < encoded.length; i += chunkSize)
        controller.enqueue(encoded.slice(i, i + chunkSize));
      controller.close();
    },
  });
}

test('SSE decoding handles split frames, CRLF and multibyte text', async () => {
  const { readChatGptStream } = loadInference();
  assert.equal(
    await readChatGptStream(
      stream(
        [
          { type: 'response.output_text.delta', delta: 'Caffè ☕' },
          { type: 'response.completed', response: { status: 'completed' } },
        ],
        1,
      ),
    ),
    'Caffè ☕',
  );
});
test('a limit error after a text delta is failure, not successful partial output', async () => {
  const { readChatGptStream } = loadInference();
  await assert.rejects(
    readChatGptStream(
      stream([
        { type: 'response.output_text.delta', delta: 'partial' },
        {
          type: 'response.failed',
          response: { error: { code: 'subscription_sharing_usage_limit_exceeded' } },
        },
      ]),
    ),
    (error) => error.code === 'CHATGPT_USAGE_LIMIT' && error.status === 429,
  );
});
test('truncated and incomplete streams cannot report success', async () => {
  const { readChatGptStream } = loadInference();
  for (const events of [
    [{ type: 'response.output_text.delta', delta: 'partial' }],
    [{ type: 'response.incomplete' }],
  ]) {
    await assert.rejects(readChatGptStream(stream(events)), (error) =>
      ['CHATGPT_STREAM_INTERRUPTED', 'CHATGPT_RESPONSE_INCOMPLETE'].includes(error.code),
    );
  }
});
test('inference validates the account model and sends only supported SIWC request fields', async () => {
  const calls = [];
  const { ChatGptInferenceHelper } = loadInference(async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/models'))
      return {
        ok: true,
        json: async () => ({
          models: [{ slug: 'eligible', display_name: 'Eligible', visibility: 'list' }],
        }),
      };
    return {
      ok: true,
      headers: { get: (key) => (key === 'content-type' ? 'text/event-stream' : null) },
      body: stream([
        { type: 'response.output_text.delta', delta: 'OK' },
        { type: 'response.completed' },
      ]),
    };
  });
  assert.equal(await ChatGptInferenceHelper.respond('oauth-token', 'eligible', 'Hello'), 'OK');
  const body = JSON.parse(calls[1].options.body);
  assert.deepEqual(body, {
    model: 'eligible',
    input: [{ role: 'user', content: 'Hello' }],
    store: false,
    stream: true,
  });
  assert.equal(calls[1].options.headers.Authorization, 'Bearer oauth-token');
  await assert.rejects(
    ChatGptInferenceHelper.respond('oauth-token', 'another', 'Hello'),
    (error) => error.code === 'CHATGPT_MODEL_UNAVAILABLE',
  );
});
test('provider 401 becomes integration reauthorization, not application 401', async () => {
  const { ChatGptInferenceHelper } = loadInference(async () => ({
    ok: false,
    status: 401,
    json: async () => ({ detail: 'provider detail' }),
    headers: { get: () => 'req-test' },
  }));
  await assert.rejects(
    ChatGptInferenceHelper.models('oauth-token'),
    (error) =>
      error.status === 409 && error.providerStatus === 401 && error.requestId === 'req-test',
  );
});
test('the internal broker signs the delegated session and never accepts another connection', async () => {
  const previous = process.env.CHATGPT_SERVICE_SECRET;
  process.env.CHATGPT_SERVICE_SECRET = 'test-service-secret'.repeat(3);
  try {
    const { ChatGptAuthHelper } = load(
      authPath,
      {},
      {
        fetch: async (url, options) => {
          const h = options.headers;
          const hash = (text) => crypto.createHash('sha256').update(text).digest('hex');
          const canonical = [
            h['x-chatgpt-timestamp'],
            h['x-chatgpt-request-id'],
            'POST',
            '/internal/integrations/chatgpt/access-token',
            hash(options.body),
            hash('Bearer session'),
          ].join('\n');
          assert.equal(
            h['x-chatgpt-signature'],
            crypto
              .createHmac('sha256', process.env.CHATGPT_SERVICE_SECRET)
              .update(canonical)
              .digest('hex'),
          );
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: {
                accessToken: 'secret',
                connectionId: 'another',
                expiresAt: new Date(Date.now() + 3600000).toISOString(),
              },
            }),
          };
        },
      },
    );
    await assert.rejects(
      ChatGptAuthHelper.accessToken('Bearer session', 'selected'),
      (error) => error.code === 'CHATGPT_AUTH_UNAVAILABLE',
    );
  } finally {
    if (previous === undefined) delete process.env.CHATGPT_SERVICE_SECRET;
    else process.env.CHATGPT_SERVICE_SECRET = previous;
  }
});
