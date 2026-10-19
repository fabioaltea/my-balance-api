const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const { load } = require('./load-ts.cjs');
const url = process.env.PUSH_TEST_DATABASE_URL;
// Use an explicitly provided disposable database, in an isolated schema. Never load .env files here.
test('PostgreSQL: device isolation, sessions, migration, fan-out, worker and receipts', { skip: !url }, async t => {
  const schema = `push_test_${Date.now()}`;
  const admin = new Pool({ connectionString: url });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = new Pool({ connectionString: url, options: `-c search_path=${schema},public` });
  const authRoot = process.env.PUSH_AUTH_SOURCE_DIR || path.resolve(__dirname, '../../../AuthService/src');
  try {
    await pool.query(`CREATE TABLE users(user_email VARCHAR(255) PRIMARY KEY,push_token TEXT);
      CREATE TABLE sessions(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_email VARCHAR(255) NOT NULL REFERENCES users(user_email),
        device_id TEXT NOT NULL,device_type TEXT NOT NULL,product_name TEXT NOT NULL,scopes JSONB,created_at TIMESTAMPTZ DEFAULT NOW());`);
    const migration = fs.readFileSync(path.join(__dirname, '../sql/migrations/005-device-push-notifications.sql'), 'utf8');
    await pool.query(migration); await pool.query(migration);
    await pool.query("INSERT INTO users(user_email) VALUES ('alice@example.test'),('bob@example.test')");
    const { DbHelper } = load(path.join(authRoot, 'helpers/db.helper.ts'), { pg: { Pool: class { constructor() { return pool; } } } });
    process.env.PUSH_EXPO_PROJECT_ID = 'test-project'; process.env.PUSH_EXPO_PROJECT_ID_DEVELOPMENT = 'test-dev';
    process.env.PUSH_TARGET_APP_VARIANT = 'production'; process.env.PUSH_LEGACY_FALLBACK_ENABLED = 'false';
    const { PushDevicesHelper } = load(path.join(authRoot, 'helpers/push-devices.helper.ts'), { './db.helper': { DbHelper } });
    async function login(userId, deviceId, appVariant = 'production') {
      const sessionId = await DbHelper.createSession({ userEmail: userId, deviceId, scopes: [], deviceType: 'ios', productName: 'MyBalance', appVariant });
      return { userId, deviceId, sessionId, appVariant, deviceType: 'ios', product: 'MyBalance' };
    }
    const enable = (id, token, intent = 'enable') => PushDevicesHelper.execute(id, 'write', { intent, permissionStatus: 'granted', expoPushToken: token });
    const aliceA = await login('alice@example.test', 'phone-a');
    const aliceB = await login('alice@example.test', 'phone-b');
    await enable(aliceA, 'ExpoPushToken[phoneA]'); await enable(aliceB, 'ExpoPushToken[phoneB]');
    await t.test('two phones remain independent and OFF is local', async () => {
      assert.equal((await pool.query('SELECT * FROM push_devices')).rows.length, 2);
      await PushDevicesHelper.execute(aliceA, 'disable');
      assert.equal((await PushDevicesHelper.execute(aliceB, 'read')).registered, true);
      await assert.rejects(enable(aliceA, 'ExpoPushToken[phoneA]', 'reconcile'), error => error.code === 'PUSH_DISABLED');
      await enable(aliceA, 'ExpoPushToken[phoneA]');
    });
    await t.test('concurrent same-device registration remains unique', async () => {
      await Promise.all([enable(aliceA, 'ExpoPushToken[phoneA]'), enable(aliceA, 'ExpoPushToken[phoneA]')]);
      assert.equal((await pool.query("SELECT * FROM push_devices WHERE device_id='phone-a'")).rows.length, 1);
    });
    await t.test('account switch and exact session revocation cannot affect new owner', async () => {
      const bobA = await login('bob@example.test', 'phone-a');
      await enable(bobA, 'ExpoPushToken[phoneA]');
      await assert.rejects(enable(aliceA, 'ExpoPushToken[phoneA]'), error => error.code === 'SESSION_REVOKED');
      await DbHelper.revokeExactSession({ id: aliceA.sessionId, user_email: aliceA.userId, device_id: aliceA.deviceId, product_name: aliceA.product, app_variant: aliceA.appVariant });
      assert.equal((await PushDevicesHelper.execute(bobA, 'read')).registered, true);
      assert.equal(await DbHelper.resolveSession(aliceA), null);
      assert.equal(await DbHelper.resolveSession({ ...bobA, sessionId: undefined }), null); // Legacy JWT cannot authorize a newly issued session.
      assert.equal(await DbHelper.resolveSession({ ...bobA, userId: aliceA.userId }), null);
    });
    await t.test('legacy token is adopted only by matching installation', async () => {
      const id = await login('alice@example.test', 'legacy-phone');
      await pool.query("UPDATE users SET push_token='ExpoPushToken[legacy]' WHERE user_email='alice@example.test'");
      await assert.rejects(enable(id, 'ExpoPushToken[other]', 'restoreLegacy'), error => error.code === 'LEGACY_TOKEN_NOT_MATCHED');
      assert.equal((await enable(id, 'ExpoPushToken[legacy]', 'restoreLegacy')).registered, true);
      assert.equal((await pool.query("SELECT push_token FROM users WHERE user_email='alice@example.test'")).rows[0].push_token, null);
      await PushDevicesHelper.execute(id, 'disable');
      await assert.rejects(enable(id, 'ExpoPushToken[legacy]', 'restoreLegacy'), error => error.code === 'LEGACY_TOKEN_NOT_MATCHED');
    });
    await t.test('preferences survive switching back to an account', async () => {
      const returned = await login('alice@example.test', 'phone-a');
      assert.equal((await PushDevicesHelper.execute(returned, 'read')).enabled, true);
      assert.equal((await enable(returned, 'ExpoPushToken[phoneA]', 'reconcile')).registered, true);
    });
    const dev = await login('alice@example.test', 'phone-dev', 'development'); await enable(dev, 'ExpoPushToken[dev]');
    let calls = [], response = { ok: true, status: 200, data: { status: 'ok', id: 'ticket' } }, networkError = false, malformedJSON = false;
    const { PushNotificationsHelper } = load(path.join(__dirname, '../src/helpers/push-notifications.helper.ts'), { './db.helper': { DbHelper } }, {
      fetch: async (url, options) => { calls.push({ url, body: JSON.parse(options.body) }); if (networkError) throw new Error('timeout');
        return { ok: response.ok, status: response.status, json: async () => { if (malformedJSON) throw new Error('not JSON'); return { data: response.data }; } }; },
    });
    const movement = id => ({ movementId: id, description: 'Test', transactions: [{ amount: '-24.90', account: 'Card' }] });
    await t.test('fan-out excludes dev and disabled destinations; accepted is not delivered', async () => {
      const result = await PushNotificationsHelper.enqueueMovement('alice@example.test', 'sheet', movement('first'));
      assert.equal(result.recipientCount, 2); assert.equal(result.status, 'accepted'); assert.equal(calls.length, 2);
      assert.equal(calls.some(x => x.body.to === 'ExpoPushToken[dev]'), false);
      assert.equal(calls[0].body.data.amount, -24.9);
      assert.equal((await pool.query("SELECT COUNT(*)::int n FROM push_notification_jobs WHERE status='accepted'")).rows[0].n, 2);
    });
    await t.test('late invalid receipt does not invalidate rotated token', async () => {
      const current = await DbHelper.getSessionByDeviceId('phone-b', 'MyBalance');
      const identity = { ...aliceB, sessionId: current.id };
      await enable(identity, 'ExpoPushToken[rotated]', 'reconcile');
      response.data = { ticket: { status: 'error', details: { error: 'DeviceNotRegistered' } } };
      await pool.query("UPDATE push_notification_jobs SET next_attempt_at=NOW() WHERE status='accepted'");
      await PushNotificationsHelper.run(5);
      assert.equal((await PushDevicesHelper.execute(identity, 'read')).registered, true);
      assert.equal((await pool.query("SELECT COUNT(*)::int n FROM push_notification_jobs WHERE status='failed'")).rows[0].n, 2);
    });
    await t.test('429 queues bounded retry; concurrent workers claim once', async () => {
      response = { ok: false, status: 429, data: null };
      const result = await PushNotificationsHelper.enqueueMovement('alice@example.test', 'sheet', movement('retry'));
      assert.equal(result.status, 'queued');
      await pool.query("UPDATE push_notification_jobs SET next_attempt_at=NOW() WHERE movement_id='retry'");
      calls = []; response = { ok: true, status: 200, data: { status: 'ok', id: 'retry-ticket' } };
      await Promise.all([PushNotificationsHelper.run(10), PushNotificationsHelper.run(10)]);
      const count = (await pool.query("SELECT COUNT(*)::int n FROM push_notification_jobs WHERE movement_id='retry'")).rows[0].n;
      assert.equal(calls.length, count);
    });
    await t.test('explicit HTTP 500 with a non-JSON body is retryable', async () => {
      response = { ok: false, status: 500, data: null }; malformedJSON = true;
      const result = await PushNotificationsHelper.enqueueMovement('alice@example.test', 'sheet', movement('http500'));
      assert.equal(result.status, 'queued'); malformedJSON = false;
    });
    await t.test('uncertain network send is not blindly retried', async () => {
      networkError = true; const result = await PushNotificationsHelper.enqueueMovement('alice@example.test', 'sheet', movement('unknown'));
      assert.equal(result.status, 'failed');
      const before = calls.length; await PushNotificationsHelper.run(10); assert.equal(calls.length, before);
      assert.ok((await pool.query("SELECT 1 FROM push_notification_jobs WHERE movement_id='unknown' AND status='unknown'")).rows.length);
    });
    await t.test('reinstalled device claims token without enabling new account', async () => {
      const id = await login('bob@example.test', 'new-installation-id');
      const claimed = await enable(id, 'ExpoPushToken[phoneA]', 'claim');
      assert.equal(claimed.enabled, false); assert.equal(claimed.registered, false);
      const old = (await pool.query("SELECT expo_push_token FROM push_devices WHERE user_email='alice@example.test' AND device_id='phone-a'")).rows[0];
      assert.equal(old.expo_push_token, null);
    });
    await t.test('session expiry removes destination from fan-out', async () => {
      await pool.query('UPDATE sessions SET expires_at=NOW()-INTERVAL \'1 second\'');
      assert.equal((await PushNotificationsHelper.enqueueMovement('alice@example.test', 'sheet', movement('expired'))).recipientCount, 0);
    });
  } finally { await pool.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end(); }
});
