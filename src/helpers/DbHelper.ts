import { Pool } from 'pg';


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
            const { rows } = await client.query('SELECT token FROM users WHERE user_email = $1 AND pin = $2', [userEmail, pin]);
            if (rows.length < 1) {
                return null;
            }else{
                return rows[0].token;
            }
        } catch (error) {
            console.error('Error retrieving credentials:', error);
            throw new Error('Error retrieving credentials');
        }
        finally {
            client.release();
        }
    }
}