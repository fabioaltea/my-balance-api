// Authentication interfaces
import { Request } from "express";
import { JwtPayload as BaseJwtPayload } from "jsonwebtoken";

// JWT Payload interfaces
export interface JwtPayload extends BaseJwtPayload {
  userId: string;
  scopes: string[];
  type: "access" | "refresh";
  deviceType?: "web" | "ios" | "android";
  deviceId?: string;
}

export interface AccessTokenPayload {
  userId: string;
  scopes: string[];
  deviceType?: "web" | "ios" | "android";
  deviceId?: string;
}

// Refresh token interfaces
export interface RefreshTokenData {
  raw: string;
  hash: string;
  expiresAt: Date;
}

// Authenticated request interface
export interface AuthenticatedRequest extends Request {
  userId?: string;
  scopes?: string[];
  deviceType?: "web" | "ios" | "android";
  deviceId?: string;
}

// Auth controller request interfaces
export interface GoogleCallbackRequest {
  authorizationCode: string;
  codeVerifier?: string; // Optional for PKCE support
  deviceId: string;
  deviceType?: "ios" | "android" | "web"; // Default to web
}

export interface RefreshRequest {
  refreshToken: string;
  deviceId: string;
}

export interface PasskeyLoginRequest {
  passkeyAssertion: any; // WebAuthn assertion response
  deviceId: string;
}

export interface LogoutRequest {
  refreshToken?: string;
  deviceId: string;
}
