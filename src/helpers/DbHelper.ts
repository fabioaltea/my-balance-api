import { Pool } from 'pg';
import CryptoJS from 'crypto-js';

export class DbHelper{
    private static _pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false,
        },
    });
      
    public static async getData() {
        const client = await DbHelper._pool.connect();
        try {
            const { rows } = await client.query('SELECT * FROM users');
            console.log(rows)
            return rows;
        } finally {
            client.release();
        }
    }

    public static async getDbCredentials(userEmail:string, pin:string) {
        const client = await DbHelper._pool.connect();
        try {
            const { rows } = await client.query('SELECT token, spreadsheet_id FROM users WHERE user_email = $1 AND pin = $2', [userEmail, pin]);
            if (rows.length < 1) {
                return null;
            }else{
                return rows[0];
            }
        } catch (error) {
            console.error('Error retrieving credentials:', error);
            throw new Error('Error retrieving credentials');
        }
        finally {
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
}