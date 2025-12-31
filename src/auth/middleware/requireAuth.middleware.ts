import { Request, Response, NextFunction } from "express";
import { JwtHelper } from "../helpers/jwt.helper";

export interface AuthenticatedRequest extends Request {
  userId?: string;
  scopes?: string[];
}

export class RequireAuthMiddleware {
  /**
   * Middleware to verify JWT access token
   */
  public static verify(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void {
    try {
      const authHeader = req.headers.authorization;
      const token = JwtHelper.extractTokenFromHeader(authHeader);

      if (!token) {
        res.status(401).json({
          success: false,
          error: "Missing authorization token",
          code: "MISSING_TOKEN",
        });
        return;
      }

      const payload = JwtHelper.verifyAccessToken(token);

      // Attach user info to request
      req.userId = payload.userId;
      req.scopes = payload.scopes;

      next();
    } catch (error: any) {
      console.error("Authentication middleware error:", error);

      let errorCode = "INVALID_TOKEN";
      let message = "Invalid or expired access token";

      if (error.message.includes("expired")) {
        errorCode = "TOKEN_EXPIRED";
        message = "Access token has expired";
      }

      res.status(401).json({
        success: false,
        error: message,
        code: errorCode,
      });
    }
  }

  /**
   * Middleware to verify specific scopes
   */
  public static requireScopes(requiredScopes: string[]) {
    return (
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction
    ): void => {
      if (!req.scopes) {
        res.status(403).json({
          success: false,
          error: "Authentication required",
          code: "AUTH_REQUIRED",
        });
        return;
      }

      const hasAllScopes = requiredScopes.every((scope) =>
        req.scopes?.includes(scope)
      );

      if (!hasAllScopes) {
        res.status(403).json({
          success: false,
          error: "Insufficient permissions",
          code: "INSUFFICIENT_SCOPES",
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
   */
  public static optional(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void {
    try {
      const authHeader = req.headers.authorization;
      const token = JwtHelper.extractTokenFromHeader(authHeader);

      if (token) {
        const payload = JwtHelper.verifyAccessToken(token);
        req.userId = payload.userId;
        req.scopes = payload.scopes;
      }

      next();
    } catch (error) {
      // For optional auth, we continue even if token is invalid
      next();
    }
  }
}
