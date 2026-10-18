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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatGptAuthHelper = exports.ChatGptApiError = void 0;
const crypto_1 = __importDefault(require("crypto"));
class ChatGptApiError extends Error {
    constructor(code, status = 502, providerStatus, requestId) {
        super(code);
        this.code = code;
        this.status = status;
        this.providerStatus = providerStatus;
        this.requestId = requestId;
    }
}
exports.ChatGptApiError = ChatGptApiError;
class ChatGptAuthHelper {
    static accessToken(authorization, connectionId, signal) {
        return __awaiter(this, void 0, void 0, function* () {
            const secret = process.env.CHATGPT_SERVICE_SECRET || '';
            if (secret.length < 32)
                throw new ChatGptApiError('CHATGPT_NOT_CONFIGURED', 503);
            const path = '/internal/integrations/chatgpt/access-token';
            const body = JSON.stringify(connectionId ? { connectionId } : {});
            const timestamp = Date.now().toString();
            const requestId = crypto_1.default.randomUUID();
            const hash = (value) => crypto_1.default.createHash('sha256').update(value).digest('hex');
            const canonical = [timestamp, requestId, 'POST', path, hash(body), hash(authorization)].join('\n');
            try {
                const response = yield fetch(`${process.env.AUTH_SERVICE_URL || 'http://localhost:8082'}${path}`, {
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
                        'x-chatgpt-signature': crypto_1.default
                            .createHmac('sha256', secret)
                            .update(canonical)
                            .digest('hex'),
                    },
                });
                const result = yield response.json();
                if (!response.ok || !result.success) {
                    const code = typeof result.code === 'string' && /^CHATGPT_[A-Z_]+$/.test(result.code)
                        ? result.code
                        : 'CHATGPT_AUTH_UNAVAILABLE';
                    throw new ChatGptApiError(code, response.status === 401 ? 409 : response.status);
                }
                const data = result.data;
                if (!data ||
                    typeof data.accessToken !== 'string' ||
                    !data.accessToken ||
                    typeof data.connectionId !== 'string' ||
                    !Number.isFinite(Date.parse(data.expiresAt)) ||
                    Date.parse(data.expiresAt) <= Date.now() ||
                    (connectionId && data.connectionId !== connectionId))
                    throw new ChatGptApiError('CHATGPT_AUTH_UNAVAILABLE', 502);
                return {
                    connectionId: data.connectionId,
                    accessToken: data.accessToken,
                    expiresAt: data.expiresAt,
                };
            }
            catch (error) {
                if (error instanceof ChatGptApiError)
                    throw error;
                throw new ChatGptApiError('CHATGPT_AUTH_UNAVAILABLE', 503);
            }
        });
    }
}
exports.ChatGptAuthHelper = ChatGptAuthHelper;
//# sourceMappingURL=chatgpt-auth.helper.js.map