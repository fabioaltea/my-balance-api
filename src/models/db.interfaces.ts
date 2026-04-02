// Database interfaces

export interface CreateUserRequest {
  email: string;
  name: string;
  picture: string;
  emailVerified: boolean;
}

export interface UpdateUserRequest {
  name?: string;
  picture?: string;
  emailVerified?: boolean;
  spreadsheetId?: string;
}

export interface CreateSessionRequest {
  userEmail: string;
  deviceId: string;
  scopes: string[];
  deviceType?: 'web' | 'ios' | 'android';
}

export interface UpdateSessionRequest {
  scopes?: string[];
  deviceType?: string;
}
