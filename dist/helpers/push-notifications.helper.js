"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PushNotificationsHelper = void 0;
const db_helper_1 = require("./db.helper");
const push_payload_helper_1 = require("./push-payload.helper");
const MAX_ATTEMPTS = 4;
const UUID = /^[a-f0-9-]{36}$/i;
class PushNotificationsHelper {
    static enqueueMovement(email, spreadsheetId, movement) {
        return __awaiter(this, void 0, void 0, function* () {
            let client;
            const ids = [];
            let persisted = false;
            try {
                client = yield db_helper_1.DbHelper.connect();
                const variant = process.env.PUSH_TARGET_APP_VARIANT || 'production';
                const project = variant === 'development'
                    ? process.env.PUSH_EXPO_PROJECT_ID_DEVELOPMENT
                    : process.env.PUSH_EXPO_PROJECT_ID;
                if (!project)
                    throw new Error('PUSH_PROJECT_NOT_CONFIGURED');
                const result = yield client.query(`SELECT p.id,p.expo_push_token FROM push_devices p JOIN sessions s ON s.id=p.session_id
        WHERE p.user_email=$1 AND p.product_name='MyBalance' AND p.app_variant=$2 AND p.expo_project_id=$3
        AND p.enabled AND p.expo_push_token IS NOT NULL AND s.user_email=p.user_email AND s.device_id=p.device_id
        AND s.product_name=p.product_name AND s.app_variant=p.app_variant AND s.expires_at>NOW()`, [email, variant, project]);
                const recipients = result.rows;
                if (!recipients.length &&
                    variant === 'production' &&
                    process.env.PUSH_LEGACY_FALLBACK_ENABLED === 'true') {
                    const legacy = yield client.query(`SELECT NULL::uuid as id,u.push_token as expo_push_token FROM users u WHERE u.user_email=$1
          AND u.push_token IS NOT NULL AND NOT EXISTS (SELECT 1 FROM push_devices WHERE user_email=u.user_email AND product_name='MyBalance')
          AND NOT EXISTS (SELECT 1 FROM push_devices WHERE expo_push_token=u.push_token)`, [email]);
                    recipients.push(...legacy.rows);
                }
                if (!recipients.length)
                    return { status: 'skipped', recipientCount: 0 };
                const payload = (0, push_payload_helper_1.movementPushPayload)(movement, spreadsheetId, email);
                yield client.query('BEGIN');
                for (const recipient of recipients) {
                    const job = yield client.query(`INSERT INTO push_notification_jobs(movement_id,user_email,push_device_id,expo_push_token,payload)
          VALUES ($1,$2,$3,$4,$5) ON CONFLICT (movement_id,expo_push_token) DO UPDATE SET movement_id=EXCLUDED.movement_id RETURNING id`, [
                        movement.movementId,
                        email,
                        recipient.id,
                        recipient.expo_push_token,
                        JSON.stringify(Object.assign(Object.assign({}, payload), { to: recipient.expo_push_token })),
                    ]);
                    ids.push(job.rows[0].id);
                }
                yield client.query('COMMIT');
                persisted = true;
                // Bound the synchronous first attempt; remaining recipients are processed by the scheduled worker.
                yield this.run(2, ids);
                const states = yield client.query('SELECT status FROM push_notification_jobs WHERE id=ANY($1::uuid[])', [ids]);
                const statuses = states.rows.map((r) => r.status);
                return {
                    status: statuses.every((s) => ['accepted', 'done'].includes(s))
                        ? 'accepted'
                        : statuses.some((s) => ['pending', 'sending'].includes(s))
                            ? 'queued'
                            : statuses.every((s) => s === 'skipped')
                                ? 'skipped'
                                : 'failed',
                    recipientCount: ids.length,
                };
            }
            catch (error) {
                if (client)
                    yield client.query('ROLLBACK').catch(() => { });
                console.error('Push enqueue failed:', error instanceof Error ? error.message : 'Unknown error');
                return {
                    status: persisted ? 'queued' : 'failed',
                    recipientCount: persisted ? ids.length : 0,
                };
            }
            finally {
                client === null || client === void 0 ? void 0 : client.release();
            }
        });
    }
    static request(path, body) {
        return __awaiter(this, void 0, void 0, function* () {
            const headers = { 'Content-Type': 'application/json' };
            if (process.env.EXPO_PUSH_ACCESS_TOKEN)
                headers.Authorization = `Bearer ${process.env.EXPO_PUSH_ACCESS_TOKEN}`;
            const response = yield fetch(`https://exp.host/--/api/v2/push/${path}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(5000),
            });
            let json = null;
            try {
                json = yield response.json();
            }
            catch (_a) { }
            return { status: response.status, ok: response.ok, json };
        });
    }
    static run() {
        return __awaiter(this, arguments, void 0, function* (limit = 20, ids) {
            const client = yield db_helper_1.DbHelper.connect();
            let processed = 0;
            try {
                // A crashed process may already have handed the payload to Expo. Do not blindly resend it.
                yield client.query(`UPDATE push_notification_jobs SET status='unknown',error_code='INTERRUPTED_SEND',updated_at=NOW()
        WHERE status='sending' AND lease_until<NOW()`);
                for (let index = 0; index < Math.min(Math.max(limit, 0), 20); index++) {
                    const result = yield client.query(`WITH due AS (
          SELECT id FROM push_notification_jobs WHERE status IN ('pending','accepted') AND next_attempt_at<=NOW()
          AND (lease_until IS NULL OR lease_until<NOW()) AND ($1::uuid[] IS NULL OR id=ANY($1::uuid[]))
          ORDER BY next_attempt_at FOR UPDATE SKIP LOCKED LIMIT 1)
          UPDATE push_notification_jobs j SET lease_until=NOW()+INTERVAL '1 minute',
          status=CASE WHEN j.status='pending' THEN 'sending' ELSE j.status END, updated_at=NOW()
          FROM due WHERE j.id=due.id RETURNING j.*`, [ids || null]);
                    const job = result.rows[0];
                    if (!job)
                        break;
                    if (job.status === 'accepted')
                        yield this.receipt(client, job);
                    else
                        yield this.send(client, job);
                    processed++;
                }
                yield client.query(`DELETE FROM push_notification_jobs WHERE status IN ('done','failed','skipped','unknown') AND updated_at<NOW()-INTERVAL '30 days'`);
                return { processed };
            }
            finally {
                client.release();
            }
        });
    }
    static send(client, job) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            const current = job.push_device_id
                ? yield client.query(`SELECT p.id FROM push_devices p JOIN sessions s ON s.id=p.session_id
        WHERE p.id=$1 AND p.user_email=$2 AND p.expo_push_token=$3 AND p.enabled AND s.user_email=p.user_email
        AND s.device_id=p.device_id AND s.product_name=p.product_name AND s.app_variant=p.app_variant AND s.expires_at>NOW()`, [job.push_device_id, job.user_email, job.expo_push_token])
                : yield client.query(`SELECT user_email FROM users WHERE user_email=$1 AND push_token=$2
        AND NOT EXISTS (SELECT 1 FROM push_devices WHERE user_email=$1 AND product_name='MyBalance')`, [job.user_email, job.expo_push_token]);
            if (!current.rows.length) {
                yield this.finish(client, job.id, 'skipped', 'DESTINATION_REVOKED');
                return;
            }
            yield client.query('UPDATE push_notification_jobs SET attempts=attempts+1 WHERE id=$1', [
                job.id,
            ]);
            job.attempts++;
            try {
                const response = yield this.request('send', job.payload);
                if (!response.ok) {
                    yield this.retry(client, job, `HTTP_${response.status}`, response.status === 429 || response.status >= 500);
                    return;
                }
                const ticket = Array.isArray((_a = response.json) === null || _a === void 0 ? void 0 : _a.data)
                    ? (_b = response.json) === null || _b === void 0 ? void 0 : _b.data[0]
                    : (_c = response.json) === null || _c === void 0 ? void 0 : _c.data;
                if ((ticket === null || ticket === void 0 ? void 0 : ticket.status) === 'ok' && typeof ticket.id === 'string') {
                    yield client.query(`UPDATE push_notification_jobs SET status='accepted',ticket_id=$2,error_code=NULL,
          next_attempt_at=NOW()+INTERVAL '15 minutes',lease_until=NULL,updated_at=NOW() WHERE id=$1`, [job.id, ticket.id]);
                }
                else {
                    const code = ((_d = ticket === null || ticket === void 0 ? void 0 : ticket.details) === null || _d === void 0 ? void 0 : _d.error) || 'INVALID_EXPO_TICKET';
                    if (code === 'DeviceNotRegistered')
                        yield this.invalidate(client, job);
                    yield this.retry(client, job, code, code === 'MessageRateExceeded');
                }
            }
            catch (error) {
                yield this.finish(client, job.id, 'unknown', 'SEND_OUTCOME_UNKNOWN');
            }
        });
    }
    static receipt(client, job) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            if (Date.now() - new Date(job.created_at).getTime() > 23 * 60 * 60 * 1000) {
                yield this.finish(client, job.id, 'unknown', 'RECEIPT_EXPIRED');
                return;
            }
            try {
                const response = yield this.request('getReceipts', { ids: [job.ticket_id] });
                const receipt = response.ok ? (_b = (_a = response.json) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b[job.ticket_id] : null;
                if (!receipt) {
                    yield client.query(`UPDATE push_notification_jobs SET next_attempt_at=NOW()+INTERVAL '5 minutes',lease_until=NULL WHERE id=$1`, [job.id]);
                    return;
                }
                if (receipt.status === 'ok')
                    yield this.finish(client, job.id, 'done', null);
                else {
                    const code = ((_c = receipt.details) === null || _c === void 0 ? void 0 : _c.error) || 'EXPO_RECEIPT_ERROR';
                    if (code === 'DeviceNotRegistered')
                        yield this.invalidate(client, job);
                    yield this.finish(client, job.id, 'failed', code);
                }
            }
            catch (error) {
                yield client.query(`UPDATE push_notification_jobs SET next_attempt_at=NOW()+INTERVAL '5 minutes',lease_until=NULL WHERE id=$1`, [job.id]);
            }
        });
    }
    static invalidate(client, job) {
        return __awaiter(this, void 0, void 0, function* () {
            if (job.push_device_id)
                yield client.query(`UPDATE push_devices SET expo_push_token=NULL,invalidated_at=NOW(),updated_at=NOW()
      WHERE id=$1 AND expo_push_token=$2`, [job.push_device_id, job.expo_push_token]);
            else
                yield client.query('UPDATE users SET push_token=NULL WHERE user_email=$1 AND push_token=$2', [
                    job.user_email,
                    job.expo_push_token,
                ]);
        });
    }
    static finish(client, id, status, code) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!UUID.test(id))
                throw new Error('Invalid push job id');
            yield client.query('UPDATE push_notification_jobs SET status=$2,error_code=$3,lease_until=NULL,updated_at=NOW() WHERE id=$1', [id, status, code]);
        });
    }
    static retry(client, job, code, temporary) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!temporary || job.attempts >= MAX_ATTEMPTS) {
                yield this.finish(client, job.id, 'failed', code);
                return;
            }
            yield client.query(`UPDATE push_notification_jobs SET status='pending',error_code=$2,lease_until=NULL,
      next_attempt_at=NOW()+($3 * INTERVAL '1 second'),updated_at=NOW() WHERE id=$1`, [job.id, code, 60 * Math.pow(2, job.attempts - 1)]);
        });
    }
}
exports.PushNotificationsHelper = PushNotificationsHelper;
//# sourceMappingURL=push-notifications.helper.js.map