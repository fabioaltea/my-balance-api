import type { PoolClient } from 'pg';
import { DbHelper } from './db.helper';
import { movementPushPayload } from './push-payload.helper';

const MAX_ATTEMPTS = 4;
const UUID = /^[a-f0-9-]{36}$/i;
export interface PushSummary {
  status: 'accepted' | 'queued' | 'failed' | 'skipped';
  recipientCount: number;
}

export class PushNotificationsHelper {
  static async enqueueMovement(
    email: string,
    spreadsheetId: string,
    movement: any,
  ): Promise<PushSummary> {
    let client: PoolClient | undefined;
    const ids: string[] = [];
    let persisted = false;
    try {
      client = await DbHelper.connect();
      const variant = process.env.PUSH_TARGET_APP_VARIANT || 'production';
      const project =
        variant === 'development'
          ? process.env.PUSH_EXPO_PROJECT_ID_DEVELOPMENT
          : process.env.PUSH_EXPO_PROJECT_ID;
      if (!project) throw new Error('PUSH_PROJECT_NOT_CONFIGURED');
      const result = await client.query(
        `SELECT p.id,p.expo_push_token FROM push_devices p JOIN sessions s ON s.id=p.session_id
        WHERE p.user_email=$1 AND p.product_name='MyBalance' AND p.app_variant=$2 AND p.expo_project_id=$3
        AND p.enabled AND p.expo_push_token IS NOT NULL AND s.user_email=p.user_email AND s.device_id=p.device_id
        AND s.product_name=p.product_name AND s.app_variant=p.app_variant AND s.expires_at>NOW()`,
        [email, variant, project],
      );
      const recipients = result.rows;
      if (
        !recipients.length &&
        variant === 'production' &&
        process.env.PUSH_LEGACY_FALLBACK_ENABLED === 'true'
      ) {
        const legacy = await client.query(
          `SELECT NULL::uuid as id,u.push_token as expo_push_token FROM users u WHERE u.user_email=$1
          AND u.push_token IS NOT NULL AND NOT EXISTS (SELECT 1 FROM push_devices WHERE user_email=u.user_email AND product_name='MyBalance')
          AND NOT EXISTS (SELECT 1 FROM push_devices WHERE expo_push_token=u.push_token)`,
          [email],
        );
        recipients.push(...legacy.rows);
      }
      if (!recipients.length) return { status: 'skipped', recipientCount: 0 };
      const payload = movementPushPayload(movement, spreadsheetId, email);
      await client.query('BEGIN');
      for (const recipient of recipients) {
        const job = await client.query(
          `INSERT INTO push_notification_jobs(movement_id,user_email,push_device_id,expo_push_token,payload)
          VALUES ($1,$2,$3,$4,$5) ON CONFLICT (movement_id,expo_push_token) DO UPDATE SET movement_id=EXCLUDED.movement_id RETURNING id`,
          [
            movement.movementId,
            email,
            recipient.id,
            recipient.expo_push_token,
            JSON.stringify({ ...payload, to: recipient.expo_push_token }),
          ],
        );
        ids.push(job.rows[0].id);
      }
      await client.query('COMMIT');
      persisted = true;
      // Bound the synchronous first attempt; remaining recipients are processed by the scheduled worker.
      await this.run(2, ids);
      const states = await client.query(
        'SELECT status FROM push_notification_jobs WHERE id=ANY($1::uuid[])',
        [ids],
      );
      const statuses = states.rows.map((r: any) => r.status);
      return {
        status: statuses.every((s: string) => ['accepted', 'done'].includes(s))
          ? 'accepted'
          : statuses.some((s: string) => ['pending', 'sending'].includes(s))
            ? 'queued'
            : statuses.every((s: string) => s === 'skipped')
              ? 'skipped'
              : 'failed',
        recipientCount: ids.length,
      };
    } catch (error) {
      if (client) await client.query('ROLLBACK').catch((): void => {});
      console.error(
        'Push enqueue failed:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      return {
        status: persisted ? 'queued' : 'failed',
        recipientCount: persisted ? ids.length : 0,
      };
    } finally {
      client?.release();
    }
  }

  private static async request(path: string, body: object) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (process.env.EXPO_PUSH_ACCESS_TOKEN)
      headers.Authorization = `Bearer ${process.env.EXPO_PUSH_ACCESS_TOKEN}`;
    const response = await fetch(`https://exp.host/--/api/v2/push/${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    let json: any = null;
    try {
      json = await response.json();
    } catch {}
    return { status: response.status, ok: response.ok, json };
  }

  static async run(limit = 20, ids?: string[]) {
    const client = await DbHelper.connect();
    let processed = 0;
    try {
      // A crashed process may already have handed the payload to Expo. Do not blindly resend it.
      await client.query(`UPDATE push_notification_jobs SET status='unknown',error_code='INTERRUPTED_SEND',updated_at=NOW()
        WHERE status='sending' AND lease_until<NOW()`);
      for (let index = 0; index < Math.min(Math.max(limit, 0), 20); index++) {
        const result = await client.query(
          `WITH due AS (
          SELECT id FROM push_notification_jobs WHERE status IN ('pending','accepted') AND next_attempt_at<=NOW()
          AND (lease_until IS NULL OR lease_until<NOW()) AND ($1::uuid[] IS NULL OR id=ANY($1::uuid[]))
          ORDER BY next_attempt_at FOR UPDATE SKIP LOCKED LIMIT 1)
          UPDATE push_notification_jobs j SET lease_until=NOW()+INTERVAL '1 minute',
          status=CASE WHEN j.status='pending' THEN 'sending' ELSE j.status END, updated_at=NOW()
          FROM due WHERE j.id=due.id RETURNING j.*`,
          [ids || null],
        );
        const job = result.rows[0];
        if (!job) break;
        if (job.status === 'accepted') await this.receipt(client, job);
        else await this.send(client, job);
        processed++;
      }
      await client.query(
        `DELETE FROM push_notification_jobs WHERE status IN ('done','failed','skipped','unknown') AND updated_at<NOW()-INTERVAL '30 days'`,
      );
      return { processed };
    } finally {
      client.release();
    }
  }

  private static async send(client: any, job: any) {
    const current = job.push_device_id
      ? await client.query(
          `SELECT p.id FROM push_devices p JOIN sessions s ON s.id=p.session_id
        WHERE p.id=$1 AND p.user_email=$2 AND p.expo_push_token=$3 AND p.enabled AND s.user_email=p.user_email
        AND s.device_id=p.device_id AND s.product_name=p.product_name AND s.app_variant=p.app_variant AND s.expires_at>NOW()`,
          [job.push_device_id, job.user_email, job.expo_push_token],
        )
      : await client.query(
          `SELECT user_email FROM users WHERE user_email=$1 AND push_token=$2
        AND NOT EXISTS (SELECT 1 FROM push_devices WHERE user_email=$1 AND product_name='MyBalance')`,
          [job.user_email, job.expo_push_token],
        );
    if (!current.rows.length) {
      await this.finish(client, job.id, 'skipped', 'DESTINATION_REVOKED');
      return;
    }
    await client.query('UPDATE push_notification_jobs SET attempts=attempts+1 WHERE id=$1', [
      job.id,
    ]);
    job.attempts++;
    try {
      const response = await this.request('send', job.payload);
      if (!response.ok) {
        await this.retry(
          client,
          job,
          `HTTP_${response.status}`,
          response.status === 429 || response.status >= 500,
        );
        return;
      }
      const ticket = Array.isArray(response.json?.data)
        ? response.json?.data[0]
        : response.json?.data;
      if (ticket?.status === 'ok' && typeof ticket.id === 'string') {
        await client.query(
          `UPDATE push_notification_jobs SET status='accepted',ticket_id=$2,error_code=NULL,
          next_attempt_at=NOW()+INTERVAL '15 minutes',lease_until=NULL,updated_at=NOW() WHERE id=$1`,
          [job.id, ticket.id],
        );
      } else {
        const code = ticket?.details?.error || 'INVALID_EXPO_TICKET';
        if (code === 'DeviceNotRegistered') await this.invalidate(client, job);
        await this.retry(client, job, code, code === 'MessageRateExceeded');
      }
    } catch (error) {
      await this.finish(client, job.id, 'unknown', 'SEND_OUTCOME_UNKNOWN');
    }
  }

  private static async receipt(client: any, job: any) {
    if (Date.now() - new Date(job.created_at).getTime() > 23 * 60 * 60 * 1000) {
      await this.finish(client, job.id, 'unknown', 'RECEIPT_EXPIRED');
      return;
    }
    try {
      const response = await this.request('getReceipts', { ids: [job.ticket_id] });
      const receipt = response.ok ? response.json?.data?.[job.ticket_id] : null;
      if (!receipt) {
        await client.query(
          `UPDATE push_notification_jobs SET next_attempt_at=NOW()+INTERVAL '5 minutes',lease_until=NULL WHERE id=$1`,
          [job.id],
        );
        return;
      }
      if (receipt.status === 'ok') await this.finish(client, job.id, 'done', null);
      else {
        const code = receipt.details?.error || 'EXPO_RECEIPT_ERROR';
        if (code === 'DeviceNotRegistered') await this.invalidate(client, job);
        await this.finish(client, job.id, 'failed', code);
      }
    } catch (error) {
      await client.query(
        `UPDATE push_notification_jobs SET next_attempt_at=NOW()+INTERVAL '5 minutes',lease_until=NULL WHERE id=$1`,
        [job.id],
      );
    }
  }

  private static async invalidate(client: any, job: any) {
    if (job.push_device_id)
      await client.query(
        `UPDATE push_devices SET expo_push_token=NULL,invalidated_at=NOW(),updated_at=NOW()
      WHERE id=$1 AND expo_push_token=$2`,
        [job.push_device_id, job.expo_push_token],
      );
    else
      await client.query('UPDATE users SET push_token=NULL WHERE user_email=$1 AND push_token=$2', [
        job.user_email,
        job.expo_push_token,
      ]);
  }
  private static async finish(client: any, id: string, status: string, code: string | null) {
    if (!UUID.test(id)) throw new Error('Invalid push job id');
    await client.query(
      'UPDATE push_notification_jobs SET status=$2,error_code=$3,lease_until=NULL,updated_at=NOW() WHERE id=$1',
      [id, status, code],
    );
  }
  private static async retry(client: any, job: any, code: string, temporary: boolean) {
    if (!temporary || job.attempts >= MAX_ATTEMPTS) {
      await this.finish(client, job.id, 'failed', code);
      return;
    }
    await client.query(
      `UPDATE push_notification_jobs SET status='pending',error_code=$2,lease_until=NULL,
      next_attempt_at=NOW()+($3 * INTERVAL '1 second'),updated_at=NOW() WHERE id=$1`,
      [job.id, code, 60 * Math.pow(2, job.attempts - 1)],
    );
  }
}
