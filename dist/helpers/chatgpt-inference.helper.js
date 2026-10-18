"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatGptInferenceHelper = void 0;
exports.chatGptProviderError = chatGptProviderError;
exports.readChatGptStream = readChatGptStream;
const chatgpt_auth_helper_1 = require("./chatgpt-auth.helper");
const knownCodes = {
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
function chatGptProviderError(code, status, requestId) {
    const mapped = typeof code === 'string' ? knownCodes[code] : undefined;
    const fallback = status === 401
        ? ['CHATGPT_REAUTH_REQUIRED', 409]
        : status === 429
            ? ['CHATGPT_USAGE_LIMIT', 429]
            : status === 403
                ? ['CHATGPT_PERMISSION_REQUIRED', 403]
                : ['CHATGPT_PROVIDER_UNAVAILABLE', 502];
    const [publicCode, publicStatus] = mapped || fallback;
    return new chatgpt_auth_helper_1.ChatGptApiError(publicCode, publicStatus, status, requestId);
}
/** A delta is provisional: consume the terminal event before reporting success. */
function readChatGptStream(body, requestId) {
    return __awaiter(this, void 0, void 0, function* () {
        const reader = body.getReader();
        const decoder = new TextDecoder();
        let buffer = '', outputText = '', bytes = 0, completed = false;
        const consume = (frame) => {
            var _a, _b, _c, _d, _e;
            const data = frame
                .split(/\r?\n/)
                .filter((line) => line.startsWith('data:'))
                .map((line) => line.slice(5).trimStart())
                .join('\n');
            if (!data || data === '[DONE]')
                return;
            let event;
            try {
                event = JSON.parse(data);
            }
            catch (_f) {
                throw new chatgpt_auth_helper_1.ChatGptApiError('CHATGPT_INVALID_RESPONSE', 502);
            }
            if (event.type === 'response.failed' || event.type === 'error')
                throw chatGptProviderError(((_b = (_a = event.response) === null || _a === void 0 ? void 0 : _a.error) === null || _b === void 0 ? void 0 : _b.code) || ((_c = event.error) === null || _c === void 0 ? void 0 : _c.code) || event.code, 200, requestId);
            if (event.type === 'response.incomplete')
                throw new chatgpt_auth_helper_1.ChatGptApiError('CHATGPT_RESPONSE_INCOMPLETE', 502);
            if (event.type === 'response.output_text.delta') {
                if (typeof event.delta !== 'string')
                    throw new chatgpt_auth_helper_1.ChatGptApiError('CHATGPT_INVALID_RESPONSE', 502);
                outputText += event.delta;
                if (outputText.length > 64000)
                    throw new chatgpt_auth_helper_1.ChatGptApiError('CHATGPT_RESPONSE_TOO_LARGE', 502);
            }
            if (event.type === 'response.completed') {
                if (((_d = event.response) === null || _d === void 0 ? void 0 : _d.status) && event.response.status !== 'completed')
                    throw new chatgpt_auth_helper_1.ChatGptApiError('CHATGPT_INVALID_RESPONSE', 502);
                completed = true;
                if (!outputText && Array.isArray((_e = event.response) === null || _e === void 0 ? void 0 : _e.output)) {
                    outputText = event.response.output
                        .flatMap((item) => item.content || [])
                        .filter((item) => item.type === 'output_text' && typeof item.text === 'string')
                        .map((item) => item.text)
                        .join('');
                }
                if (outputText.length > 64000)
                    throw new chatgpt_auth_helper_1.ChatGptApiError('CHATGPT_RESPONSE_TOO_LARGE', 502);
            }
        };
        try {
            while (true) {
                const chunk = yield reader.read();
                if (chunk.done)
                    break;
                bytes += chunk.value.byteLength;
                if (bytes > 2 * 1024 * 1024)
                    throw new chatgpt_auth_helper_1.ChatGptApiError('CHATGPT_RESPONSE_TOO_LARGE', 502);
                buffer += decoder.decode(chunk.value, { stream: true });
                let match;
                while ((match = /\r?\n\r?\n/.exec(buffer))) {
                    consume(buffer.slice(0, match.index));
                    buffer = buffer.slice(match.index + match[0].length);
                }
                if (buffer.length > 512000)
                    throw new chatgpt_auth_helper_1.ChatGptApiError('CHATGPT_RESPONSE_TOO_LARGE', 502);
                if (completed)
                    return outputText;
            }
            buffer += decoder.decode();
            if (buffer.trim())
                consume(buffer);
            if (!completed)
                throw new chatgpt_auth_helper_1.ChatGptApiError('CHATGPT_STREAM_INTERRUPTED', 502);
            return outputText;
        }
        finally {
            yield reader.cancel().catch(() => { });
            reader.releaseLock();
        }
    });
}
class ChatGptInferenceHelper {
    static request(path, token, signal, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const response = yield fetch(`https://api.openai.com/v1${path}`, Object.assign(Object.assign({ method: payload ? 'POST' : 'GET', redirect: 'error', headers: Object.assign({ Authorization: `Bearer ${token}` }, (payload ? { 'Content-Type': 'application/json', Accept: 'text/event-stream' } : {})) }, (payload ? { body: JSON.stringify(payload) } : {})), { signal: signal
                        ? AbortSignal.any([signal, AbortSignal.timeout(payload ? 90000 : 10000)])
                        : AbortSignal.timeout(payload ? 90000 : 10000) }));
                if (!response.ok) {
                    const data = yield response.json().catch(() => ({}));
                    throw chatGptProviderError((_a = data.error) === null || _a === void 0 ? void 0 : _a.code, response.status, response.headers.get('x-request-id') || undefined);
                }
                return response;
            }
            catch (error) {
                if (error instanceof chatgpt_auth_helper_1.ChatGptApiError)
                    throw error;
                throw new chatgpt_auth_helper_1.ChatGptApiError('CHATGPT_PROVIDER_UNAVAILABLE', 503);
            }
        });
    }
    static models(token, signal) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.request('/models', token, signal);
            const data = yield response.json();
            if (!Array.isArray(data.models))
                throw new chatgpt_auth_helper_1.ChatGptApiError('CHATGPT_INVALID_MODEL_CATALOG', 502);
            return data.models
                .filter((model) => model.visibility === 'list' &&
                typeof model.slug === 'string' &&
                typeof model.display_name === 'string')
                .map((model) => ({ slug: model.slug, displayName: model.display_name }));
        });
    }
    static respond(token, model, prompt, signal) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const models = yield this.models(token, signal);
            if (!models.some((item) => item.slug === model))
                throw new chatgpt_auth_helper_1.ChatGptApiError('CHATGPT_MODEL_UNAVAILABLE', 400);
            const response = yield this.request('/responses', token, signal, {
                model,
                input: [{ role: 'user', content: prompt }],
                store: false,
                stream: true,
            });
            if (!response.body || !((_a = response.headers.get('content-type')) === null || _a === void 0 ? void 0 : _a.includes('text/event-stream')))
                throw new chatgpt_auth_helper_1.ChatGptApiError('CHATGPT_INVALID_RESPONSE', 502);
            try {
                return yield readChatGptStream(response.body, response.headers.get('x-request-id') || undefined);
            }
            catch (error) {
                if (error instanceof chatgpt_auth_helper_1.ChatGptApiError)
                    throw error;
                throw new chatgpt_auth_helper_1.ChatGptApiError('CHATGPT_STREAM_INTERRUPTED', 502);
            }
        });
    }
}
exports.ChatGptInferenceHelper = ChatGptInferenceHelper;
//# sourceMappingURL=chatgpt-inference.helper.js.map