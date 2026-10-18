import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { RequireAuthMiddleware } from '../middleware/requireAuth.middleware';
import { AuthenticatedRequest } from '../models';
import { ChatGptAuthHelper, ChatGptApiError } from '../helpers/chatgpt-auth.helper';
import { ChatGptInferenceHelper } from '../helpers/chatgpt-inference.helper';
import { ChatGptPreferences } from '../helpers/chatgpt-preferences.helper';

const chatgptIntegrationRoutes = Router();

chatgptIntegrationRoutes.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
chatgptIntegrationRoutes.use(RequireAuthMiddleware.verify);
chatgptIntegrationRoutes.use(
  rateLimit({ windowMs: 60000, limit: 30, standardHeaders: true, legacyHeaders: false }),
);

function connectionId(value: unknown) {
  if (value === undefined) return undefined;
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  )
    throw new ChatGptApiError('CHATGPT_INVALID_CONNECTION', 400);
  return value;
}
function authorization(req: AuthenticatedRequest) {
  return req.header('authorization') || req.header('x-authorization') || '';
}
function handler(
  operation: (req: AuthenticatedRequest, res: Response, signal: AbortSignal) => Promise<void>,
) {
  return async (req: AuthenticatedRequest, res: Response) => {
    const controller = new AbortController();
    const close = () => controller.abort();
    res.on('close', close);
    try {
      await operation(req, res, controller.signal);
    } catch (error) {
      if (res.destroyed) return;
      const known = error instanceof ChatGptApiError;
      res.status(known ? error.status : 503).json({
        success: false,
        code: known ? error.code : 'CHATGPT_SERVICE_UNAVAILABLE',
        ...(known && error.requestId ? { requestId: error.requestId } : {}),
        ...(known && error.providerStatus ? { providerStatus: error.providerStatus } : {}),
      });
    } finally {
      res.off('close', close);
    }
  };
}
chatgptIntegrationRoutes.get(
  '/models',
  handler(async (req, res, signal) => {
    const access = await ChatGptAuthHelper.accessToken(
      authorization(req),
      connectionId(req.query.connectionId),
      signal,
    );
    const models = await ChatGptInferenceHelper.models(access.accessToken, signal);
    const preferred = await ChatGptPreferences.get(req.userId!, access.connectionId);
    res.json({
      success: true,
      data: {
        connectionId: access.connectionId,
        models,
        selectedModel: models.some((item) => item.slug === preferred)
          ? preferred
          : models[0]?.slug || null,
      },
    });
  }),
);
chatgptIntegrationRoutes.put(
  '/preferences',
  handler(async (req, res, signal) => {
    const access = await ChatGptAuthHelper.accessToken(
      authorization(req),
      connectionId(req.body.connectionId),
      signal,
    );
    const model = req.body.model;
    if (typeof model !== 'string' || model.length > 200)
      throw new ChatGptApiError('CHATGPT_INVALID_MODEL', 400);
    const models = await ChatGptInferenceHelper.models(access.accessToken, signal);
    if (!models.some((item) => item.slug === model))
      throw new ChatGptApiError('CHATGPT_MODEL_UNAVAILABLE', 400);
    await ChatGptPreferences.set(req.userId!, access.connectionId, model);
    res.json({ success: true, data: { connectionId: access.connectionId, selectedModel: model } });
  }),
);
chatgptIntegrationRoutes.post(
  '/responses',
  rateLimit({ windowMs: 60000, limit: 10, standardHeaders: true, legacyHeaders: false }),
  handler(async (req, res, signal) => {
    const { prompt, model } = req.body;
    if (
      typeof prompt !== 'string' ||
      !prompt.trim() ||
      prompt.length > 12000 ||
      typeof model !== 'string' ||
      !model ||
      model.length > 200
    )
      throw new ChatGptApiError('CHATGPT_INVALID_REQUEST', 400);
    const access = await ChatGptAuthHelper.accessToken(
      authorization(req),
      connectionId(req.body.connectionId),
      signal,
    );
    const outputText = await ChatGptInferenceHelper.respond(
      access.accessToken,
      model,
      prompt,
      signal,
    );
    res.json({ success: true, data: { connectionId: access.connectionId, model, outputText } });
  }),
);

export { chatgptIntegrationRoutes };
