import type { AuthInfo } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { Router, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { RequireAuthMiddleware } from '../middleware/requireAuth.middleware';
import type { AuthenticatedRequest } from '../models';
import { myBalanceMcpHandler } from './server';

const mcpRoutes = Router();
const mcpNodeHandler = toNodeHandler(myBalanceMcpHandler, {
  onerror: (error) => {
    console.error(`[MCP] HTTP adapter error: ${error.message}`);
  },
});

const mcpRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: {
    success: false,
    error: 'Too many MCP requests, please try again later',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

type AuthenticatedMcpRequest = AuthenticatedRequest & { auth?: AuthInfo };

mcpRoutes.post(
  '/',
  mcpRateLimit,
  RequireAuthMiddleware.verify,
  RequireAuthMiddleware.requireScopes(['read']),
  async (req: AuthenticatedMcpRequest, res: Response): Promise<void> => {
    const authorization =
      req.headers.authorization || (req.headers['x-authorization'] as string | undefined) || '';
    const token = authorization.replace(/^Bearer\s+/i, '');

    req.auth = {
      token,
      clientId: req.deviceId || 'mybalance-client',
      scopes: req.scopes || [],
      extra: {
        userId: req.userId,
        deviceType: req.deviceType || 'web',
        deviceId: req.deviceId,
      },
    };

    await mcpNodeHandler(req, res, req.body);
  },
);

mcpRoutes.all('/', (_req, res) => {
  res.setHeader('Allow', 'POST, OPTIONS');
  res.status(405).json({
    success: false,
    error: 'Method not allowed',
    code: 'METHOD_NOT_ALLOWED',
  });
});

export { mcpRoutes };
