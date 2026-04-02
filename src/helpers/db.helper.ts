import { Pool } from 'pg';
import CryptoJS from 'crypto-js';
import base64url from 'base64url/dist/base64url';
import {
  CreateUserRequest,
  UpdateUserRequest,
  CreateSessionRequest,
  UpdateSessionRequest,
} from '../models';

// Enable SSL only for production databases (Neon, etc.)
const useSSL =
  process.env.DATABASE_URL?.includes('neon.tech') ||
  process.env.DATABASE_URL?.includes('sslmode=require') ||
  process.env.NODE_ENV === 'production';

export class DbHelper {
  private static _pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: useSSL ? { rejectUnauthorized: false } : false,
  });

  public static async getData() {
    const client = await DbHelper._pool.connect();
    try {
      const { rows } = await client.query('SELECT * FROM users');
      return rows;
    } finally {
      client.release();
    }
  }

  public static async getDbCredentials(userEmail: string, pin: string) {
    const client = await DbHelper._pool.connect();
    try {
      const { rows } = await client.query(
        'SELECT token, spreadsheet_id FROM users WHERE user_email = $1 AND pin = $2',
        [userEmail, pin],
      );
      if (rows.length < 1) {
        return null;
      } else {
        return rows[0];
      }
    } catch (error) {
      console.error('Error retrieving credentials:', error);
      throw new Error('Error retrieving credentials');
    } finally {
      client.release();
    }
  }

  public static async saveAuthChallenge(userEmail: string, challenge: string) {
    const client = await DbHelper._pool.connect();
    try {
      await client.query(
        `UPDATE users SET webauthn_challenge = $1, webauthn_challenge_created = NOW() WHERE user_email = $2`,
        [challenge, userEmail],
      );
    } catch (error) {
      console.error('Error saving credentials:', error);
      throw new Error('Error saving credentials');
    } finally {
      client.release();
    }
  }

  public static async getUserCredentials(userEmail: string, clientCredentialId: string) {
    const client = await DbHelper._pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT credentials.credential_id, credentials.cred_public_key, credentials.counter, users.token FROM credentials JOIN users ON credentials.user_id = users.user_email WHERE users.user_email = $1 AND credentials.credential_id = $2`,
        [userEmail, clientCredentialId],
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
      console.error('Error retrieving credentials:', error);
      throw new Error('Error retrieving credentials');
    } finally {
      client.release();
    }
  }

  public static async saveUserToken(userEmail: string, token: string) {
    const client = await DbHelper._pool.connect();
    try {
      const r = await client.query(`UPDATE users SET token = $1 WHERE user_email = $2`, [
        token,
        userEmail,
      ]);
    } catch (error) {
      console.error('Error saving user token:', error);
      throw new Error('Error saving user token');
    } finally {
      client.release();
    }
  }

  public static async saveUserCredentials(
    userEmail: string,
    credentialID: string,
    credentialPublicKey: string,
    counter: number,
  ) {
    const client = await DbHelper._pool.connect();
    try {
      await client.query(
        `INSERT INTO credentials (credential_id, cred_public_key, counter, user_id) VALUES ($1, $2, $3, $4)`,
        [credentialID, credentialPublicKey, counter, userEmail],
      );
    } catch (error) {
      console.error('Error saving credentials:', error);
      throw new Error('Error saving credentials');
    } finally {
      client.release();
    }
  }

  public static async getAuthChallenge(userEmail: string) {
    console.log('DbHelper.getAuthChallenge called for user:', userEmail);
    const client = await DbHelper._pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT webauthn_challenge, webauthn_challenge_created FROM users WHERE user_email = $1`,
        [userEmail],
      );
      if (rows.length < 1) {
        return null;
      } else {
        return rows[0];
      }
    } catch (error) {
      console.error('Error getting Auth challengeq:', error);
      throw new Error('Error getting Auth challenge');
    } finally {
      client.release();
    }
  }

  public static async insertUser(userEmail: string, spreadsheetId: string) {
    const client = await DbHelper._pool.connect();
    try {
      await client.query(
        `INSERT INTO users (user_email, spreadsheet_id) VALUES ($1, $2) RETURNING *`,
        [userEmail, spreadsheetId],
      );
    } catch (error) {
      console.error('Error inserting user:', error);
      throw new Error('Error inserting user');
    } finally {
      client.release();
    }
  }

  public static async updateUserLastAccess(userEmail: string) {
    const client = await DbHelper._pool.connect();
    try {
      await client.query(`UPDATE users SET last_access = NOW() WHERE user_email = $1`, [userEmail]);
    } catch (error) {
      console.error('Error updating user last access:', error);
      throw new Error('Error updating user last access');
    } finally {
      client.release();
    }
  }

  public static decryptToken(encryptedToken: string, secretKey: string): string {
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
        `SELECT id, user_email, user_name, user_picture, email_verified,
                credential_public_key, counter, created_at, last_access,
                spreadsheet_id, shortcut_key, push_token
         FROM users WHERE user_email = $1`,
        [email],
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Error getting user by email:', error);
      throw new Error('Error getting user by email');
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
        `SELECT id, user_email, email_verified, 
                credential_public_key, counter, created_at, last_access, spreadsheet_id 
         FROM users WHERE id = $1`,
        [userId],
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Error getting user by ID:', error);
      throw new Error('Error getting user by ID');
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
        `INSERT INTO users (user_email, user_name, user_picture, email_verified, created_at, last_access)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         RETURNING id, user_email, user_name, user_picture, email_verified, created_at, last_access`,
        [userData.email, userData.name, userData.picture, userData.emailVerified],
      );
      return rows[0];
    } catch (error) {
      console.error('Error creating user:', error);
      throw new Error('Error creating user');
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

      if (userData.name !== undefined) {
        updateFields.push(`user_name = $${paramIndex++}`);
        values.push(userData.name);
      }
      if (userData.picture !== undefined) {
        updateFields.push(`user_picture = $${paramIndex++}`);
        values.push(userData.picture);
      }
      if (userData.emailVerified !== undefined) {
        updateFields.push(`email_verified = $${paramIndex++}`);
        values.push(userData.emailVerified);
      }
      if (userData.spreadsheetId !== undefined) {
        updateFields.push(`spreadsheet_id = $${paramIndex++}`);
        values.push(userData.spreadsheetId);
      }

      updateFields.push(`last_access = NOW()`);
      values.push(userEmail);

      await client.query(
        `UPDATE users SET ${updateFields.join(', ')} WHERE user_email = $${paramIndex}`,
        values,
      );
    } catch (error) {
      console.error('Error updating user:', error);
      throw new Error('Error updating user');
    } finally {
      client.release();
    }
  }

  /**
   * Store encrypted Google refresh token in user_google_tokens table
   * Uses UPSERT to ensure only one token per user+device_type
   */
  public static async storeGoogleRefreshToken(
    userEmail: string,
    encryptedToken: string,
    deviceType: 'web' | 'ios' | 'android' = 'web',
    productName: string = 'MyBalance',
  ) {
    const client = await DbHelper._pool.connect();
    try {
      await client.query(
        `INSERT INTO user_google_tokens (user_email, device_type, product_name, google_refresh_token, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (user_email, device_type, product_name)
         DO UPDATE SET google_refresh_token = $4, updated_at = NOW()`,
        [userEmail, deviceType, productName, encryptedToken],
      );
    } catch (error) {
      console.error('Error storing Google refresh token:', error);
      throw new Error('Error storing Google refresh token');
    } finally {
      client.release();
    }
  }

  /**
   * Get encrypted Google refresh token from user_google_tokens table
   */
  public static async getGoogleRefreshToken(
    userEmail: string,
    deviceType: 'web' | 'ios' | 'android' = 'web',
    productName: string = 'MyBalance',
  ): Promise<string | null> {
    const client = await DbHelper._pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT google_refresh_token FROM user_google_tokens
         WHERE user_email = $1 AND device_type = $2 AND product_name = $3`,
        [userEmail, deviceType, productName],
      );

      return rows[0]?.google_refresh_token || null;
    } catch (error) {
      console.error('Error getting Google refresh token:', error);
      throw new Error('Error getting Google refresh token');
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
        `INSERT INTO sessions (user_email, device_id, scopes, device_type, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING id`,
        [
          sessionData.userEmail,
          sessionData.deviceId,
          JSON.stringify(sessionData.scopes),
          sessionData.deviceType || 'web',
        ],
      );
      return rows[0].id;
    } catch (error) {
      console.error('Error creating session:', error);
      throw new Error('Error creating session');
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
        `SELECT id, user_email, device_id, scopes, device_type, created_at
         FROM sessions WHERE device_id = $1
         ORDER BY created_at DESC LIMIT 1`,
        [deviceId],
      );

      if (rows.length > 0) {
        const row = rows[0];
        // Parse scopes - handle both string and already-parsed array
        let parsedScopes = [];
        try {
          if (typeof row.scopes === 'string') {
            parsedScopes = JSON.parse(row.scopes);
          } else if (Array.isArray(row.scopes)) {
            parsedScopes = row.scopes;
          }
        } catch (error) {
          console.error('Error parsing scopes:', error, 'Raw value:', row.scopes);
          parsedScopes = [];
        }

        return {
          ...row,
          scopes: parsedScopes,
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting session:', error);
      throw new Error('Error getting session');
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

      if (updateData.scopes !== undefined) {
        updateFields.push(`scopes = $${paramIndex++}`);
        values.push(JSON.stringify(updateData.scopes));
      }
      if (updateData.deviceType !== undefined) {
        updateFields.push(`device_type = $${paramIndex++}`);
        values.push(updateData.deviceType);
      }

      if (updateFields.length === 0) {
        return; // Nothing to update
      }

      values.push(sessionId);

      await client.query(
        `UPDATE sessions SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
        values,
      );
    } catch (error) {
      console.error('Error updating session:', error);
      throw new Error('Error updating session');
    } finally {
      client.release();
    }
  }

  /**
   * Revoke session by device ID (deletes the session)
   */
  public static async revokeSession(deviceId: string) {
    const client = await DbHelper._pool.connect();
    try {
      await client.query(`DELETE FROM sessions WHERE device_id = $1`, [deviceId]);
    } catch (error) {
      console.error('Error revoking session:', error);
      throw new Error('Error revoking session');
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
      await client.query(`UPDATE users SET webauthn_counter = $1 WHERE id = $2`, [
        newCounter,
        userId,
      ]);
    } catch (error) {
      console.error('Error updating WebAuthn counter:', error);
      throw new Error('Error updating WebAuthn counter');
    } finally {
      client.release();
    }
  }

  /**
   * Clean old sessions (older than 30 days)
   */
  public static async cleanOldSessions() {
    const client = await DbHelper._pool.connect();
    try {
      await client.query(`DELETE FROM sessions WHERE created_at < NOW() - INTERVAL '30 days'`);
    } catch (error) {
      console.error('Error cleaning old sessions:', error);
      throw new Error('Error cleaning old sessions');
    } finally {
      client.release();
    }
  }

  // === SHORTCUT KEY METHODS ===

  /**
   * Update shortcut key for user
   */
  public static async updateShortcutKey(email: string, shortcutKey: string) {
    const client = await DbHelper._pool.connect();
    try {
      await client.query(`UPDATE users SET shortcut_key = $1 WHERE user_email = $2`, [
        shortcutKey,
        email,
      ]);
    } catch (error) {
      console.error('Error updating shortcut key:', error);
      throw new Error('Error updating shortcut key');
    } finally {
      client.release();
    }
  }

  /**
   * Get user by shortcut key
   */
  public static async getUserByShortcutKey(shortcutKey: string) {
    const client = await DbHelper._pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT id, user_email as email, email_verified,
                spreadsheet_id, shortcut_key, push_token, created_at, last_access
         FROM users WHERE shortcut_key = $1`,
        [shortcutKey],
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Error getting user by shortcut key:', error);
      throw new Error('Error getting user by shortcut key');
    } finally {
      client.release();
    }
  }

  // === PUSH NOTIFICATIONS METHODS ===

  /**
   * Save push notification token for user
   */
  public static async savePushToken(email: string, pushToken: string) {
    const client = await DbHelper._pool.connect();
    try {
      await client.query(`UPDATE users SET push_token = $1 WHERE user_email = $2`, [
        pushToken,
        email,
      ]);
    } catch (error) {
      console.error('Error saving push token:', error);
      throw new Error('Error saving push token');
    } finally {
      client.release();
    }
  }

  /**
   * Remove push notification token for user
   */
  public static async removePushToken(email: string) {
    const client = await DbHelper._pool.connect();
    try {
      await client.query(`UPDATE users SET push_token = NULL WHERE user_email = $1`, [email]);
    } catch (error) {
      console.error('Error removing push token:', error);
      throw new Error('Error removing push token');
    } finally {
      client.release();
    }
  }

  // === USER PRODUCTS / SCHEMA VERSION METHODS ===

  /**
   * Get user_products row for a user+product
   */
  public static async getUserProduct(
    userEmail: string,
    productName: string = 'MyBalance',
  ): Promise<{ spreadsheet_id: string; schema_version: number } | null> {
    const client = await DbHelper._pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT spreadsheet_id, schema_version FROM user_products
         WHERE user_email = $1 AND product_name = $2`,
        [userEmail, productName],
      );
      return rows[0] ?? null;
    } catch (error) {
      console.error('Error getting user product:', error);
      throw new Error('Error getting user product');
    } finally {
      client.release();
    }
  }

  /**
   * Get schema_version for a user+product from user_products table
   */
  public static async getSchemaVersion(
    userEmail: string,
    productName: string = 'MyBalance',
  ): Promise<number> {
    const product = await this.getUserProduct(userEmail, productName);
    return product?.schema_version ?? 1;
  }

  /**
   * Update schema_version for a user+product in user_products table
   */
  public static async updateSchemaVersion(
    userEmail: string,
    schemaVersion: number,
    productName: string = 'MyBalance',
  ): Promise<void> {
    const client = await DbHelper._pool.connect();
    try {
      await client.query(
        `UPDATE user_products SET schema_version = $1
         WHERE user_email = $2 AND product_name = $3`,
        [schemaVersion, userEmail, productName],
      );
    } catch (error) {
      console.error('Error updating schema version:', error);
      throw new Error('Error updating schema version');
    } finally {
      client.release();
    }
  }

  /**
   * Upsert user_products row (insert or update spreadsheet_id + schema_version)
   */
  public static async upsertUserProduct(
    userEmail: string,
    spreadsheetId: string,
    schemaVersion: number,
    productName: string = 'MyBalance',
  ): Promise<void> {
    const client = await DbHelper._pool.connect();
    try {
      await client.query(
        `INSERT INTO user_products (user_email, product_name, spreadsheet_id, schema_version)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_email, product_name)
         DO UPDATE SET spreadsheet_id = $3, schema_version = $4`,
        [userEmail, productName, spreadsheetId, schemaVersion],
      );
    } catch (error) {
      console.error('Error upserting user product:', error);
      throw new Error('Error upserting user product');
    } finally {
      client.release();
    }
  }

  /**
   * Set setup_complete flag for a user+product
   */
  public static async setSetupComplete(
    userEmail: string,
    setupComplete: boolean = true,
    productName: string = 'MyBalance',
  ): Promise<void> {
    const client = await DbHelper._pool.connect();
    try {
      await client.query(
        `UPDATE user_products SET setup_complete = $1
         WHERE user_email = $2 AND product_name = $3`,
        [setupComplete, userEmail, productName],
      );
    } catch (error) {
      console.error('Error setting setup complete:', error);
      throw new Error('Error setting setup complete');
    } finally {
      client.release();
    }
  }

  // === WAITLIST METHODS ===

  /**
   * Add email to waitlist
   */
  public static async addToWaitlist(
    email: string,
    source: string = 'landing',
  ): Promise<{ id: string; email: string; created_at: Date }> {
    const client = await DbHelper._pool.connect();
    try {
      const { rows } = await client.query(
        `INSERT INTO waitlist (email, source)
         VALUES ($1, $2)
         ON CONFLICT (email) DO UPDATE SET source = $2
         RETURNING id, email, created_at`,
        [email, source],
      );
      return rows[0];
    } catch (error) {
      console.error('Error adding to waitlist:', error);
      throw new Error('Error adding to waitlist');
    } finally {
      client.release();
    }
  }

  /**
   * Check if email is already in waitlist
   */
  public static async isEmailInWaitlist(email: string): Promise<boolean> {
    const client = await DbHelper._pool.connect();
    try {
      const { rows } = await client.query(`SELECT id FROM waitlist WHERE email = $1`, [email]);
      return rows.length > 0;
    } catch (error) {
      console.error('Error checking waitlist:', error);
      throw new Error('Error checking waitlist');
    } finally {
      client.release();
    }
  }
}
