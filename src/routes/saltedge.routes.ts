import { Router } from 'express';
import { SaltEdgeController } from '../controllers/saltedge.controller';
import { RequireAuthMiddleware } from '../middleware/requireAuth.middleware';
import rateLimit from 'express-rate-limit';

const saltedgeRoutes = Router();

const saltedgeRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Too many requests', code: 'RATE_LIMIT_EXCEEDED' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Connect widget — create session
saltedgeRoutes.post(
  '/connect',
  saltedgeRateLimit,
  RequireAuthMiddleware.verify,
  SaltEdgeController.connect,
);

// Reconnect widget for already-linked account
saltedgeRoutes.post(
  '/reconnect/:accountId',
  saltedgeRateLimit,
  RequireAuthMiddleware.verify,
  SaltEdgeController.reconnect,
);

// Link a SaltEdge connection to a MyBalance account (after widget completes)
saltedgeRoutes.post(
  '/link',
  saltedgeRateLimit,
  RequireAuthMiddleware.verify,
  SaltEdgeController.link,
);

// Disconnect / unlink
saltedgeRoutes.delete(
  '/disconnect/:accountId',
  saltedgeRateLimit,
  RequireAuthMiddleware.verify,
  SaltEdgeController.disconnect,
);

// Manual sync
saltedgeRoutes.post(
  '/sync/:accountId',
  saltedgeRateLimit,
  RequireAuthMiddleware.verify,
  SaltEdgeController.sync,
);

// Connection status
saltedgeRoutes.get(
  '/connections/:accountId',
  saltedgeRateLimit,
  RequireAuthMiddleware.verify,
  SaltEdgeController.getConnection,
);

// Webhook — public, no JWT
saltedgeRoutes.post('/webhook', SaltEdgeController.webhook);

export { saltedgeRoutes };
