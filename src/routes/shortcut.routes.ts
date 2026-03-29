import { Router } from 'express';
import { ShortcutController } from '../controllers/shortcut.controller';
import { RequireAuthMiddleware } from '../middleware/requireAuth.middleware';
import rateLimit from 'express-rate-limit';

const shortcutRoutes = Router();

// Rate limiting for shortcut endpoints
const shortcutRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 requests per minute
  message: {
    success: false,
    error: 'Too many requests, please try again later',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

console.log('🔧 Setting up SHORTCUT routes...');

/**
 * POST /shortcut/generate - Generate new shortcut key (requires JWT auth)
 */
shortcutRoutes.post(
  '/generate',
  shortcutRateLimit,
  RequireAuthMiddleware.verify,
  ShortcutController.generateShortcutKey,
);

/**
 * GET /shortcut/key - Get current shortcut key (requires JWT auth)
 */
shortcutRoutes.get(
  '/key',
  shortcutRateLimit,
  RequireAuthMiddleware.verify,
  ShortcutController.getShortcutKey,
);

/**
 * POST /shortcut/movement - Create movement via shortcut (uses x-shortcutkey header)
 */
shortcutRoutes.post('/movement', shortcutRateLimit, ShortcutController.createMovementViaShortcut);

export { shortcutRoutes };
