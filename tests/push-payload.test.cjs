const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load-ts.cjs');
const { parseShortcutAmount, movementPushPayload } = load(require('node:path').join(__dirname, '../src/helpers/push-payload.helper.ts'));
test('amounts: exact cents, EU/US, signs and zero', () => {
  for (const [input, expected] of [[-24.9, '-24.90'], ['-24,90', '-24.90'], ['-1.234,56', '-1234.56'], ['-1,234.56', '-1234.56'], [0, '0.00'], ['+24.9', '24.90'], ['-0', '0.00']]) assert.equal(parseShortcutAmount(input), expected);
});
test('amounts: reject partial parsing, ambiguous precision, nonfinite and missing values', () => {
  for (const input of [null, undefined, '', '12abc', '1,234', '1.234', Infinity, NaN, true, {}, '1.2.3', '9007199254740992']) assert.throws(() => parseShortcutAmount(input));
});
test('saved movement determines title, amount, account, recipient and id', () => {
  const payload = movementPushPayload({ movementId: 'saved-id', description: 'Supermercato', transactions: [{ amount: '-24.90', account: 'Carta' }] }, 'sheet', 'alice@example.test');
  assert.match(payload.body, /Nuova uscita.*24,90.*Supermercato/);
  assert.equal(payload.data.amount, -24.9); assert.equal(payload.data.movementId, 'saved-id');
  assert.equal(payload.data.account, 'Carta'); assert.match(payload.data.recipientHash, /^[a-f0-9]{64}$/);
  assert.equal(payload.data.currency, 'EUR');
});
test('payload bounded with very long descriptions; income and zero labels', () => {
  const make = amount => movementPushPayload({ movementId: 'saved-id', description: '🌍'.repeat(10000), transactions: [{ amount, account: 'A'.repeat(10000) }] }, 'sheet', 'user');
  assert.ok(Buffer.byteLength(JSON.stringify(make(12))) < 4096); assert.match(make(12).body, /Nuova entrata/); assert.match(make(0).body, /Nuovo movimento/);
});
