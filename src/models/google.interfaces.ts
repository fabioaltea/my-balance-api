// Google OAuth interfaces

export interface GoogleTokens {
  idToken: string;
  refreshToken?: string;
  scopes: string[];
}

export interface GoogleIdentity {
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

export interface ExchangeCodeParams {
  authorizationCode: string;
  codeVerifier?: string; // Optional for PKCE support
  redirectUri?: string; // Optional - used for web to override default redirect URI
}

export type DeviceType = 'web' | 'ios' | 'android';
