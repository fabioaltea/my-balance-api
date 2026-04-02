import { Router } from 'express';
import { CategoriesController } from '../controllers/categories.controller';
import { RequireAuthMiddleware } from '../middleware/requireAuth.middleware';
import rateLimit from 'express-rate-limit';

const categoriesRoutes = Router();

// Rate limiting for categories endpoints
const categoriesRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // Limit each IP to 60 requests per minute
  message: {
    success: false,
    error: 'Too many requests, please try again later',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

console.log('🔧 Setting up CATEGORIES routes...');

/**
 * GET /categories/default - Recupera categorie default (pubblico)
 */
// categoriesRoutes.get(
//   "/default",
//   categoriesRateLimit,
//   CategoriesController.getDefaultCategories,
// );

/**
 * GET /categories - Recupera tutte le categorie
 */
categoriesRoutes.get(
  '/',
  categoriesRateLimit,
  RequireAuthMiddleware.verify,
  CategoriesController.getCategories,
);

/**
 * POST /categories - Crea nuova categoria
 */
categoriesRoutes.post(
  '/',
  categoriesRateLimit,
  RequireAuthMiddleware.verify,
  CategoriesController.createCategory,
);

/**
 * POST /categories/batch - Crea categorie in batch
 */
categoriesRoutes.post(
  '/batch',
  categoriesRateLimit,
  RequireAuthMiddleware.verify,
  CategoriesController.createCategoriesBatch,
);

/**
 * GET /categories/:categoryId - Recupera singola categoria
 */
categoriesRoutes.get(
  '/:categoryId',
  categoriesRateLimit,
  RequireAuthMiddleware.verify,
  CategoriesController.getCategory,
);

/**
 * PUT /categories/:categoryId - Aggiorna categoria esistente
 */
categoriesRoutes.put(
  '/:categoryId',
  categoriesRateLimit,
  RequireAuthMiddleware.verify,
  CategoriesController.updateCategory,
);

/**
 * DELETE /categories/:categoryId - Elimina categoria
 */
categoriesRoutes.delete(
  '/:categoryId',
  categoriesRateLimit,
  RequireAuthMiddleware.verify,
  CategoriesController.deleteCategory,
);

export { categoriesRoutes };
