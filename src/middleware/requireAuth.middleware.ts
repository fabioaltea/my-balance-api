import { Response, NextFunction } from "express";
import { JwtHelper } from "../helpers/jwt.helper";
import { DbHelper } from "../helpers/db.helper";
import { AuthenticatedRequest } from "../models";

export class RequireAuthMiddleware {
  /**
   * Middleware to verify JWT access token and session
   */
  public static async verify(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    console.log("🔐 === AUTH MIDDLEWARE START ===");
    try {
      const authHeader =
        req.headers.authorization || (req.headers["x-authorization"] as string);
      const token = JwtHelper.extractTokenFromHeader(authHeader);
      console.log(
        "🔐 Authorization header:",
        req.headers.authorization ? "present" : "missing",
      );
      console.log(
        "🔐 X-Authorization header:",
        req.headers["x-authorization"] ? "present" : "missing",
      );
      console.log("🔐 Extracted token:", token ? "present" : "missing");

      if (!token) {
        console.log("❌ No token found, returning 401");
        res.status(401).json({
          success: false,
          error: "Missing authorization token",
          code: "MISSING_TOKEN",
        });
        return;
      }

      console.log("🔐 Verifying access token...");
      const payload = JwtHelper.verifyAccessToken(token);
      console.log("✅ Token verified successfully. Payload:", {
        userId: payload.userId,
        scopes: payload.scopes,
        deviceType: payload.deviceType,
        deviceId: payload.deviceId,
      });

      // Verify session exists for this deviceId
      if (payload.deviceId) {
        const session = await DbHelper.getSessionByDeviceId(payload.deviceId);
        if (!session) {
          console.log("❌ Session not found for deviceId:", payload.deviceId);
          res.status(401).json({
            success: false,
            error: "Session not found or revoked",
            code: "SESSION_REVOKED",
          });
          return;
        }
        console.log("✅ Session verified for deviceId:", payload.deviceId);
      }

      // Attach user info to request
      req.userId = payload.userId;
      req.scopes = payload.scopes;
      req.deviceType = payload.deviceType || "web"; // Default to web if not specified
      req.deviceId = payload.deviceId;

      console.log("🔐 Auth middleware completed successfully, calling next()");
      next();
    } catch (error: any) {
      console.error("❌ Authentication middleware error:", error);

      let errorCode = "INVALID_TOKEN";
      let message = "Invalid or expired access token";

      if (error.message.includes("expired")) {
        errorCode = "TOKEN_EXPIRED";
        message = "Access token has expired";
      }

      console.log("❌ Returning auth error:", { errorCode, message });
      res.status(401).json({
        success: false,
        error: message,
        code: errorCode,
      });
    }
    console.log("🔐 === AUTH MIDDLEWARE END ===");
  }

  /**
   * Middleware to verify specific scopes
   */
  public static requireScopes(requiredScopes: string[]) {
    return (
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
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
        req.scopes?.includes(scope),
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
    next: NextFunction,
  ): void {
    try {
      const authHeader =
        req.headers.authorization || (req.headers["x-authorization"] as string);
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
