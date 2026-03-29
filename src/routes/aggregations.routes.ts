import { Router } from 'express';
import { AggregationsController } from '../controllers/aggregations.controller';
import { RequireAuthMiddleware } from '../middleware/requireAuth.middleware';
import rateLimit from 'express-rate-limit';

const aggregationsRoutes = Router();

// Rate limiting for aggregations endpoints
const aggregationsRateLimit = rateLimit({
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

// All aggregations routes require authentication
console.log('🔧 Setting up AGGREGATIONS routes...');

/**
 * GET /aggregations/monthly - Restituisce aggregazioni mensili
 */
console.log('🔧 Defining GET /aggregations/monthly route...');
aggregationsRoutes.get(
  '/monthly',
  aggregationsRateLimit,
  RequireAuthMiddleware.verify,
  AggregationsController.getMonthlyAggregations,
);

export { aggregationsRoutes };
