import { Pool } from "pg";
import CryptoJS from "crypto-js";
import base64url from "base64url/dist/base64url";

// New interfaces for authentication
export interface CreateUserRequest {
  email: string;
  googleSub: string;
  name: string;
  picture: string;
  emailVerified: boolean;
}

export interface UpdateUserRequest {
  name?: string;
  picture?: string;
  emailVerified?: boolean;
  googleSub?: string;
  spreadsheetId?: string;
}

export interface CreateSessionRequest {
  userEmail: string;
  deviceId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  scopes: string[];
}

export interface UpdateSessionRequest {
  refreshTokenHash?: string;
  expiresAt?: Date;
}

export class DbHelper {
  private static _pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  public static async getData() {
    const client = await DbHelper._pool.connect();
    try {
      const { rows } = await client.query("SELECT * FROM users");
      return rows;
    } finally {
      client.release();
    }
  }

  public static async getDbCredentials(userEmail: string, pin: string) {
    const client = await DbHelper._pool.connect();
    try {
      const { rows } = await client.query(
        "SELECT token, spreadsheet_id FROM users WHERE user_email = $1 AND pin = $2",
        [userEmail, pin]
      );
      if (rows.length < 1) {
        return null;
      } else {
        return rows[0];
      }
    } catch (error) {
      console.error("Error retrieving credentials:", error);
      throw new Error("Error retrieving credentials");
    } finally {
      client.release();
    }
  }

  public static async saveAuthChallenge(userEmail: string, challenge: string) {
    const client = await DbHelper._pool.connect();
    try {
      await client.query(
        `UPDATE users SET webauthn_challenge = $1, webauthn_challenge_created = NOW() WHERE user_email = $2`,
        [challenge, userEmail]
      );
    } catch (error) {
      console.error("Error saving credentials:", error);
      throw new Error("Error saving credentials");
    } finally {
      client.release();
    }
  }

  public static async getUserCredentials(userEmail: string, clientCredentialId: string) {
    const client = await DbHelper._pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT credentials.credential_id, credentials.cred_public_key, credentials.counter, users.token FROM credentials JOIN users ON credentials.user_id = users.user_email WHERE users.user_email = $1 AND credentials.credential_id = $2`,
        [userEmail, clientCredentialId]
      );
      if (rows.length < 1) {
        return null;
      } else {
        return rows.map((row) => ({
          credentialID: row.credential_id, // Keep as base64url string
          credentialPublicKey: base64url.toBuffer(row.cred_public_key), // Convert base64url string to Buffer
          counter: row.counter,
          token: row.token,
        }));
      }
    } catch (error) {
      console.error("Error retrieving credentials:", error);
      throw new Error("Error retrieving credentials");
    } finally {
      client.release();
    }
  }

  public static async saveUserToken(userEmail: string, token: string) {
    const client = await DbHelper._pool.connect();
    try {
      const r = await client.query(
        `UPDATE users SET token = $1 WHERE user_email = $2`,
        [token, userEmail]
      );
    } catch (error) {
      console.error("Error saving user token:", error);
      throw new Error("Error saving user token");
    } finally {
      client.release();
    }
  }

  public static async saveUserCredentials(
    userEmail: string,
    credentialID: string,
    credentialPublicKey: string,
    counter: number
  ) {
    const client = await DbHelper._pool.connect();
    try {
      await client.query(
        `INSERT INTO credentials (credential_id, cred_public_key, counter, user_id) VALUES ($1, $2, $3, $4)`,
        [credentialID, credentialPublicKey, counter, userEmail]
      );
    } catch (error) {
      console.error("Error saving credentials:", error);
      throw new Error("Error saving credentials");
    } finally {
      client.release();
    }
  }

  public static async getAuthChallenge(userEmail: string) {
    console.log("DbHelper.getAuthChallenge called for user:", userEmail);
    const client = await DbHelper._pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT webauthn_challenge, webauthn_challenge_created FROM users WHERE user_email = $1`,
        [userEmail]
      );
      if (rows.length < 1) {
        return null;
      } else {
        return rows[0];
      }
    } catch (error) {
      console.error("Error getting Auth challengeq:", error);
      throw new Error("Error getting Auth challenge");
    } finally {
      client.release();
    }
  }

  public static async insertUser(userEmail: string, spreadsheetId: string) {
    const client = await DbHelper._pool.connect();
    try {
      await client.query(
        `INSERT INTO users (user_email, spreadsheet_id) VALUES ($1, $2) RETURNING *`,
        [userEmail, spreadsheetId]
      );
    } catch (error) {
      console.error("Error inserting user:", error);
      throw new Error("Error inserting user");
    } finally {
      client.release();
    }
  }

  public static async updateUserLastAccess(userEmail: string) {
    const client = await DbHelper._pool.connect();
    try {
      await client.query(
        `UPDATE users SET last_access = NOW() WHERE user_email = $1`,
        [userEmail]
      );
    } catch (error) {
      console.error("Error updating user last access:", error);
      throw new Error("Error updating user last access");
    } finally {
      client.release();
    }
  }

  public static decryptToken(
    encryptedToken: string,
    secretKey: string
  ): string {
    const bytes = CryptoJS.AES.decrypt(encryptedToken, secretKey);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted;
  }

  public static hashPin(pin: string): string {
    const hash = CryptoJS.SHA256(pin);
    return hash.toString(CryptoJS.enc.Hex);
  }

  // === NEW AUTHENTICATION METHODS ===

  /**
   * Get user by email
   */
  public static async getUserByEmail(email: string) {
    const client = await DbHelper._pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT id, user_email, google_sub, email_verified, 
                credential_public_key, counter, created_at, last_access, spreadsheet_id 
         FROM users WHERE user_email = $1`,
        [email]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error("Error getting user by email:", error);
      throw new Error("Error getting user by email");
    } finally {
      client.release();
    }
  }

  /**
   * Get user by ID
   */
  public static async getUserById(userId: string) {
    const client = await DbHelper._pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT id, user_email, google_sub, email_verified, 
                credential_public_key, counter, created_at, last_access, spreadsheet_id 
         FROM users WHERE id = $1`,
        [userId]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error("Error getting user by ID:", error);
      throw new Error("Error getting user by ID");
    } finally {
      client.release();
    }
  }

  /**
   * Create new user
   */
  public static async createUser(userData: CreateUserRequest) {
    const client = await DbHelper._pool.connect();
    try {
      const { rows } = await client.query(
        `INSERT INTO users (user_email, google_sub, email_verified, created_at, last_access) 
         VALUES ($1, $2, $3, NOW(), NOW()) 
         RETURNING id, user_email, google_sub, email_verified, created_at, last_access`,
        [userData.email, userData.googleSub, userData.emailVerified]
      );
      return rows[0];
    } catch (error) {
      console.error("Error creating user:", error);
      throw new Error("Error creating user");
    } finally {
      client.release();
    }
  }

  /**
   * Update user information
   */
  public static async updateUser(userEmail: string, userData: UpdateUserRequest) {
    const client = await DbHelper._pool.connect();
    try {
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (userData.emailVerified !== undefined) {
        updateFields.push(`email_verified = $${paramIndex++}`);
        values.push(userData.emailVerified);
      }
      if (userData.googleSub !== undefined) {
        updateFields.push(`google_sub = $${paramIndex++}`);
        values.push(userData.googleSub);
      }
      if (userData.spreadsheetId !== undefined) {
        updateFields.push(`spreadsheet_id = $${paramIndex++}`);
        values.push(userData.spreadsheetId);
      }

      updateFields.push(`last_access = NOW()`);
      values.push(userEmail);

      await client.query(
        `UPDATE users SET ${updateFields.join(", ")} WHERE user_email = $${paramIndex}`,
        values
      );
    } catch (error) {
      console.error("Error updating user:", error);
      throw new Error("Error updating user");
    } finally {
      client.release();
    }
  }

  /**
   * Store encrypted Google refresh token
   */
  public static async storeGoogleRefreshToken(userEmail: string, encryptedToken: string) {
    const client = await DbHelper._pool.connect();
    try {
      await client.query(
        `UPDATE users SET google_refresh_token = $1 WHERE user_email = $2`,
        [encryptedToken, userEmail]
      );
    } catch (error) {
      console.error("Error storing Google refresh token:", error);
      throw new Error("Error storing Google refresh token");
    } finally {
      client.release();
    }
  }

  /**
   * Get encrypted Google refresh token
   */
  public static async getGoogleRefreshToken(userEmail: string): Promise<string | null> {
    const client = await DbHelper._pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT google_refresh_token FROM users WHERE user_email = $1`,
        [userEmail]
      );
      return rows.length > 0 ? rows[0].google_refresh_token : null;
    } catch (error) {
      console.error("Error getting Google refresh token:", error);
      throw new Error("Error getting Google refresh token");
    } finally {
      client.release();
    }
  }

  /**
   * Create session
   */
  public static async createSession(sessionData: CreateSessionRequest): Promise<string> {
    const client = await DbHelper._pool.connect();
    try {
      const { rows } = await client.query(
        `INSERT INTO sessions (user_email, device_id, refresh_token_hash, expires_at, scopes, created_at) 
         VALUES ($1, $2, $3, $4, $5, NOW()) 
         RETURNING id`,
        [sessionData.userEmail, sessionData.deviceId, sessionData.refreshTokenHash, 
         sessionData.expiresAt, JSON.stringify(sessionData.scopes)]
      );
      return rows[0].id;
    } catch (error) {
      console.error("Error creating session:", error);
      throw new Error("Error creating session");
    } finally {
      client.release();
    }
  }

  /**
   * Get session by device ID
   */
  public static async getSessionByDeviceId(deviceId: string) {
    const client = await DbHelper._pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT id, user_email, device_id, refresh_token_hash, expires_at, scopes, created_at 
         FROM sessions WHERE device_id = $1 AND expires_at > NOW() 
         ORDER BY created_at DESC LIMIT 1`,
        [deviceId]
      );
      
      if (rows.length > 0) {
        const row = rows[0];
        return {
          ...row,
          scopes: JSON.parse(row.scopes || '[]')
        };
      }
      return null;
    } catch (error) {
      console.error("Error getting session:", error);
      throw new Error("Error getting session");
    } finally {
      client.release();
    }
  }

  /**
   * Update session
   */
  public static async updateSession(sessionId: string, updateData: UpdateSessionRequest) {
    const client = await DbHelper._pool.connect();
    try {
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updateData.refreshTokenHash !== undefined) {
        updateFields.push(`refresh_token_hash = $${paramIndex++}`);
        values.push(updateData.refreshTokenHash);
      }
      if (updateData.expiresAt !== undefined) {
        updateFields.push(`expires_at = $${paramIndex++}`);
        values.push(updateData.expiresAt);
      }

      values.push(sessionId);

      await client.query(
        `UPDATE sessions SET ${updateFields.join(", ")} WHERE id = $${paramIndex}`,
        values
      );
    } catch (error) {
      console.error("Error updating session:", error);
      throw new Error("Error updating session");
    } finally {
      client.release();
    }
  }

  /**
   * Revoke session by device ID
   */
  public static async revokeSession(deviceId: string) {
    const client = await DbHelper._pool.connect();
    try {
      await client.query(
        `UPDATE sessions SET expires_at = NOW() WHERE device_id = $1`,
        [deviceId]
      );
    } catch (error) {
      console.error("Error revoking session:", error);
      throw new Error("Error revoking session");
    } finally {
      client.release();
    }
  }

  /**
   * Update WebAuthn counter
   */
  public static async updateWebAuthnCounter(userId: string, newCounter: number) {
    const client = await DbHelper._pool.connect();
    try {
      await client.query(
        `UPDATE users SET webauthn_counter = $1 WHERE id = $2`,
        [newCounter, userId]
      );
    } catch (error) {
      console.error("Error updating WebAuthn counter:", error);
      throw new Error("Error updating WebAuthn counter");
    } finally {
      client.release();
    }
  }

  /**
   * Clean expired sessions
   */
  public static async cleanExpiredSessions() {
    const client = await DbHelper._pool.connect();
    try {
      await client.query(`DELETE FROM sessions WHERE expires_at < NOW()`);
    } catch (error) {
      console.error("Error cleaning expired sessions:", error);
      throw new Error("Error cleaning expired sessions");
    } finally {
      client.release();
    }
  }
}
