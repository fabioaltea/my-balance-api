import { Router } from 'express';
import { MovementsController } from '../controllers/movements.controller';
import { RequireAuthMiddleware } from '../middleware/requireAuth.middleware';
import rateLimit from 'express-rate-limit';

const movementsRoutes = Router();

// Rate limiting for movements endpoints
const movementsRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 50, // Limit each IP to 50 requests per minute
  message: {
    success: false,
    error: 'Too many requests, please try again later',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// All movements routes require authentication
console.log('🔧 Setting up MOVEMENTS routes...');

/**
 * GET /movements - Recupera tutti i movements
 */
console.log('🔧 Defining GET /movements route...');
movementsRoutes.get(
  '/',
  movementsRateLimit,
  (req, res, next) => {
    console.log('🔧 GET /movements route hit - before auth middleware');
    next();
  },
  RequireAuthMiddleware.verify,
  MovementsController.getMovements,
);

/**
 * POST /movements - Crea nuovo movement
 */
movementsRoutes.post(
  '/',
  movementsRateLimit,
  RequireAuthMiddleware.verify,
  MovementsController.createMovement,
);

/**
 * POST /movements/batch - Aggiorna multipli movements in batch
 */
movementsRoutes.post(
  '/batch',
  movementsRateLimit,
  RequireAuthMiddleware.verify,
  MovementsController.updateMovementsBatch,
);

/**
 * GET /movements/:movementId - Recupera singolo movement
 */
movementsRoutes.get(
  '/:movementId',
  movementsRateLimit,
  RequireAuthMiddleware.verify,
  MovementsController.getMovement,
);

/**
 * PUT /movements/:movementId - Aggiorna movement esistente
 */
movementsRoutes.put(
  '/:movementId',
  movementsRateLimit,
  RequireAuthMiddleware.verify,
  MovementsController.updateMovement,
);

/**
 * DELETE /movements/:movementId - Elimina movement
 */
movementsRoutes.delete(
  '/:movementId',
  movementsRateLimit,
  RequireAuthMiddleware.verify,
  MovementsController.deleteMovement,
);

export { movementsRoutes };
