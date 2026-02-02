import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { RequireAuthMiddleware } from "../middleware/requireAuth.middleware";
import rateLimit from "express-rate-limit";

const authRoutes = Router();

// Rate limiting for authentication endpoints
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: {
    success: false,
    error: "Too many authentication attempts, please try again later",
    code: "RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const strictAuthRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Stricter limit for sensitive endpoints
  message: {
    success: false,
    error: "Too many attempts, please try again later",
    code: "RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public routes (with rate limiting)
authRoutes.post(
  "/google/callback",
  authRateLimit,
  AuthController.googleCallback,
);
authRoutes.post("/refresh", AuthController.refresh);
authRoutes.post(
  "/passkey/login",
  strictAuthRateLimit,
  AuthController.passkeyLogin,
);
authRoutes.post("/logout", AuthController.logout);

// Protected routes (require authentication)
authRoutes.get(
  "/profile",
  RequireAuthMiddleware.verify,
  AuthController.getProfile,
);

// Push notifications
authRoutes.post(
  "/push-token",
  RequireAuthMiddleware.verify,
  AuthController.savePushToken,
);
authRoutes.delete(
  "/push-token",
  RequireAuthMiddleware.verify,
  AuthController.removePushToken,
);

// Health check endpoint
authRoutes.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Auth service is healthy",
    timestamp: new Date().toISOString(),
  });
});

export { authRoutes };
