import { Pool } from "pg";
import CryptoJS from "crypto-js";
import base64url from "base64url/dist/base64url";

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

  public static async getUserCredentials(userEmail: string) {
    const client = await DbHelper._pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT credentials.credential_id, credentials.cred_public_key, credentials.counter, users.token FROM credentials JOIN users ON credentials.user_id = users.user_email WHERE users.user_email = $1`,
        [userEmail]
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
}
