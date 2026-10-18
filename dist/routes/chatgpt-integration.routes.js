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
exports.chatgptIntegrationRoutes = void 0;
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const requireAuth_middleware_1 = require("../middleware/requireAuth.middleware");
const chatgpt_auth_helper_1 = require("../helpers/chatgpt-auth.helper");
const chatgpt_inference_helper_1 = require("../helpers/chatgpt-inference.helper");
const chatgpt_preferences_helper_1 = require("../helpers/chatgpt-preferences.helper");
const chatgptIntegrationRoutes = (0, express_1.Router)();
exports.chatgptIntegrationRoutes = chatgptIntegrationRoutes;
chatgptIntegrationRoutes.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
});
chatgptIntegrationRoutes.use(requireAuth_middleware_1.RequireAuthMiddleware.verify);
chatgptIntegrationRoutes.use((0, express_rate_limit_1.default)({ windowMs: 60000, limit: 30, standardHeaders: true, legacyHeaders: false }));
function connectionId(value) {
    if (value === undefined)
        return undefined;
    if (typeof value !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
        throw new chatgpt_auth_helper_1.ChatGptApiError('CHATGPT_INVALID_CONNECTION', 400);
    return value;
}
function authorization(req) {
    return req.header('authorization') || req.header('x-authorization') || '';
}
function handler(operation) {
    return (req, res) => __awaiter(this, void 0, void 0, function* () {
        const controller = new AbortController();
        const close = () => controller.abort();
        res.on('close', close);
        try {
            yield operation(req, res, controller.signal);
        }
        catch (error) {
            if (res.destroyed)
                return;
            const known = error instanceof chatgpt_auth_helper_1.ChatGptApiError;
            res.status(known ? error.status : 503).json(Object.assign(Object.assign({ success: false, code: known ? error.code : 'CHATGPT_SERVICE_UNAVAILABLE' }, (known && error.requestId ? { requestId: error.requestId } : {})), (known && error.providerStatus ? { providerStatus: error.providerStatus } : {})));
        }
        finally {
            res.off('close', close);
        }
    });
}
chatgptIntegrationRoutes.get('/models', handler((req, res, signal) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const access = yield chatgpt_auth_helper_1.ChatGptAuthHelper.accessToken(authorization(req), connectionId(req.query.connectionId), signal);
    const models = yield chatgpt_inference_helper_1.ChatGptInferenceHelper.models(access.accessToken, signal);
    const preferred = yield chatgpt_preferences_helper_1.ChatGptPreferences.get(req.userId, access.connectionId);
    res.json({
        success: true,
        data: {
            connectionId: access.connectionId,
            models,
            selectedModel: models.some((item) => item.slug === preferred)
                ? preferred
                : ((_a = models[0]) === null || _a === void 0 ? void 0 : _a.slug) || null,
        },
    });
})));
chatgptIntegrationRoutes.put('/preferences', handler((req, res, signal) => __awaiter(void 0, void 0, void 0, function* () {
    const access = yield chatgpt_auth_helper_1.ChatGptAuthHelper.accessToken(authorization(req), connectionId(req.body.connectionId), signal);
    const model = req.body.model;
    if (typeof model !== 'string' || model.length > 200)
        throw new chatgpt_auth_helper_1.ChatGptApiError('CHATGPT_INVALID_MODEL', 400);
    const models = yield chatgpt_inference_helper_1.ChatGptInferenceHelper.models(access.accessToken, signal);
    if (!models.some((item) => item.slug === model))
        throw new chatgpt_auth_helper_1.ChatGptApiError('CHATGPT_MODEL_UNAVAILABLE', 400);
    yield chatgpt_preferences_helper_1.ChatGptPreferences.set(req.userId, access.connectionId, model);
    res.json({ success: true, data: { connectionId: access.connectionId, selectedModel: model } });
})));
chatgptIntegrationRoutes.post('/responses', (0, express_rate_limit_1.default)({ windowMs: 60000, limit: 10, standardHeaders: true, legacyHeaders: false }), handler((req, res, signal) => __awaiter(void 0, void 0, void 0, function* () {
    const { prompt, model } = req.body;
    if (typeof prompt !== 'string' ||
        !prompt.trim() ||
        prompt.length > 12000 ||
        typeof model !== 'string' ||
        !model ||
        model.length > 200)
        throw new chatgpt_auth_helper_1.ChatGptApiError('CHATGPT_INVALID_REQUEST', 400);
    const access = yield chatgpt_auth_helper_1.ChatGptAuthHelper.accessToken(authorization(req), connectionId(req.body.connectionId), signal);
    const outputText = yield chatgpt_inference_helper_1.ChatGptInferenceHelper.respond(access.accessToken, model, prompt, signal);
    res.json({ success: true, data: { connectionId: access.connectionId, model, outputText } });
})));
//# sourceMappingURL=chatgpt-integration.routes.js.map