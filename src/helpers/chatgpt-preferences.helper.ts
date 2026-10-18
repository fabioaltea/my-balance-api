import { DbHelper } from './db.helper';

export class ChatGptPreferences {
  static async get(userId: string, connectionId: string): Promise<string | null> {
    const client = await DbHelper.connect();
    try {
      const { rows } = await client.query(
        "SELECT model_slug FROM chatgpt_model_preferences WHERE user_email=$1 AND product_name='MyBalance' AND connection_id=$2",
        [userId, connectionId],
      );
      return rows[0]?.model_slug || null;
    } finally {
      client.release();
    }
  }
  static async set(userId: string, connectionId: string, model: string) {
    const client = await DbHelper.connect();
    try {
      await client.query(
        `INSERT INTO chatgpt_model_preferences(user_email,product_name,connection_id,model_slug)
        VALUES($1,'MyBalance',$2,$3) ON CONFLICT(user_email,product_name,connection_id)
        DO UPDATE SET model_slug=EXCLUDED.model_slug,updated_at=NOW()`,
        [userId, connectionId, model],
      );
    } finally {
      client.release();
    }
  }
}
