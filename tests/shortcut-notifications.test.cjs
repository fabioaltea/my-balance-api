const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { load } = require('./load-ts.cjs');
const root = path.join(__dirname, '../src');
async function call(amount, options = {}) {
  let saved, notified, code = 200, result;
  const push = options.push || { enqueueMovement: async (email, sheet, movement) => { notified = movement; return { status: 'accepted', recipientCount: 1 }; } };
  const { ShortcutController } = load(path.join(root, 'controllers/shortcut.controller.ts'), {
    '../helpers/db.helper': { DbHelper: { getUserByShortcutKey: async () => ({ email: 'alice@example.test', spreadsheet_id: 'sheet' }) } },
    '../helpers/mybalance': { AccountsHelper: { getAccounts: async () => [{ name: 'Card' }] },
      TransactionsHelper: { appendMovement: async (client, sheet, movement) => { saved = movement; if (options.saveError) throw new Error('Sheets unavailable'); return { ...movement, movementId: 'saved-id' }; } } },
    '../helpers/google': { GoogleTokenError: class extends Error {}, GoogleAuthHelper: { executeWithRetry: async (email,type,fn) => fn({}) } },
    '../helpers/push-payload.helper': load(path.join(root, 'helpers/push-payload.helper.ts')),
    '../helpers/push-notifications.helper': { PushNotificationsHelper: push },
  });
  const response = { status(value) { code = value; return this; }, json(value) { result = value; } };
  await ShortcutController.createMovementViaShortcut({ headers: { 'x-shortcutkey': 'key' }, body: { amount, description: 'Test', account: 'card' } }, response);
  return { saved, notified, code, result };
}
test('Shortcut normalizes amount before Sheets and notifies from saved result', async () => {
  const result = await call('-24,90'); assert.equal(result.saved.transactions[0].amount, '-24.90');
  assert.equal(result.saved.status, 'unconfirmed'); assert.equal(result.notified.movementId, 'saved-id');
  assert.equal(result.result.notification.status, 'accepted'); assert.equal(result.result.data.movementId, 'saved-id');
});
test('invalid amount fails before saving or notifying; zero is explicitly valid', async () => {
  const invalid = await call('12abc'); assert.equal(invalid.code, 400); assert.equal(invalid.saved, undefined); assert.equal(invalid.notified, undefined);
  const zero = await call(0); assert.equal(zero.result.success, true); assert.equal(zero.saved.transactions[0].amount, '0.00');
});
test('Sheets failure never notifies', async () => {
  const result = await call(-12, { saveError: true }); assert.equal(result.code, 500); assert.equal(result.notified, undefined);
});
test('push database unavailable does not turn a saved movement into an error', async () => {
  const { PushNotificationsHelper } = load(path.join(root, 'helpers/push-notifications.helper.ts'), { './db.helper': { DbHelper: { connect: async () => { throw new Error('DB unavailable'); } } } });
  const result = await call(-12, { push: PushNotificationsHelper });
  assert.equal(result.result.success, true); assert.equal(result.result.notification.status, 'failed');
});
