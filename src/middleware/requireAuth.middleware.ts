import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../models';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:8082';

export class RequireAuthMiddleware {
  /**
   * Middleware to verify JWT access token via Auth service
   * Calls POST /auth/token/verify on the centralized auth service
   */
  public static async verify(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    console.log('🔐 === AUTH MIDDLEWARE START ===');
    try {
      const authHeader = req.headers.authorization || (req.headers['x-authorization'] as string);

      console.log('🔐 Authorization header:', req.headers.authorization ? 'present' : 'missing');

      if (!authHeader) {
        console.log('❌ No auth header found, returning 401');
        res.status(401).json({
          success: false,
          error: 'Missing authorization token',
          code: 'MISSING_TOKEN',
        });
        return;
      }

      // Call auth service to verify token using fetch
      console.log('🔐 Calling auth service to verify token...');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${AUTH_SERVICE_URL}/auth/token/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok || !data.valid) {
        console.log('❌ Token invalid:', data.code);
        res.status(401).json({
          success: false,
          error: data.error || 'Invalid token',
          code: data.code || 'INVALID_TOKEN',
        });
        return;
      }

      console.log('✅ Token verified by auth service. User:', data.userId);

      // Attach user info from auth service response
      req.userId = data.userId;
      req.scopes = data.scopes;
      req.deviceType = data.deviceType || 'web';
      req.deviceId = data.deviceId;

      console.log('🔐 Auth middleware completed successfully, calling next()');
      next();
    } catch (error: any) {
      console.error('❌ Authentication middleware error:', error.message);

      // Auth service unavailable or timeout
      res.status(503).json({
        success: false,
        error: 'Authentication service unavailable',
        code: 'AUTH_SERVICE_UNAVAILABLE',
      });
    }
    console.log('🔐 === AUTH MIDDLEWARE END ===');
  }

  /**
   * Middleware to verify specific scopes
   */
  public static requireScopes(requiredScopes: string[]) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.scopes) {
        res.status(403).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
        return;
      }

      const hasAllScopes = requiredScopes.every((scope) => req.scopes?.includes(scope));

      if (!hasAllScopes) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_SCOPES',
          required: requiredScopes,
          current: req.scopes,
        });
        return;
      }

      next();
    };
  }

  /**
   * Optional authentication - doesn't fail if no token provided
   * Calls auth service but continues even if token is invalid
   */
  public static async optional(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization || (req.headers['x-authorization'] as string);

      if (authHeader) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${AUTH_SERVICE_URL}/auth/token/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authHeader,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          if (data.valid) {
            req.userId = data.userId;
            req.scopes = data.scopes;
            req.deviceType = data.deviceType;
            req.deviceId = data.deviceId;
          }
        }
      }

      next();
    } catch (error) {
      // For optional auth, we continue even if token is invalid
      next();
    }
  }
}
