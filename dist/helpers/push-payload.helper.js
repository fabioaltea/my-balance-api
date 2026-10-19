"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseShortcutAmount = parseShortcutAmount;
exports.movementPushPayload = movementPushPayload;
const crypto_1 = require("crypto");
function parseShortcutAmount(value) {
    if (typeof value !== 'number' && typeof value !== 'string')
        throw new Error('Invalid amount');
    let raw = String(value).trim().replace(/€/g, '').replace(/\s/g, '');
    if (/^-?\d{1,3}(\.\d{3})+,\d{1,2}$/.test(raw))
        raw = raw.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(,\d{3})+\.\d{1,2}$/.test(raw))
        raw = raw.replace(/,/g, '');
    else
        raw = raw.replace(',', '.');
    if (!/^[+-]?\d+(\.\d{1,2})?$/.test(raw))
        throw new Error('Amount must have at most two decimals');
    const [whole, decimals = ''] = raw.replace(/^[+-]/, '').split('.');
    const cents = Number(whole) * 100 + Number(decimals.padEnd(2, '0'));
    if (!Number.isSafeInteger(cents))
        throw new Error('Amount is out of range');
    const signed = raw.startsWith('-') && cents !== 0 ? '-' : '';
    return `${signed}${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}
function movementPushPayload(movement, spreadsheetId, email) {
    var _a;
    const transaction = (_a = movement.transactions) === null || _a === void 0 ? void 0 : _a[0];
    if (!movement.movementId || !transaction)
        throw new Error('Missing saved movement details');
    const amount = Number(parseShortcutAmount(transaction.amount));
    const display = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Math.abs(amount));
    const description = String(movement.description || '').slice(0, 120);
    const direction = amount < 0 ? 'Nuova uscita' : amount > 0 ? 'Nuova entrata' : 'Nuovo movimento';
    return {
        title: 'MyBalance',
        body: `${direction} da confermare: ${display}${description ? ` · ${description}` : ''}`,
        sound: 'default',
        data: {
            version: 1,
            type: 'movement.unconfirmed',
            movementId: movement.movementId,
            spreadsheetId,
            recipientHash: (0, crypto_1.createHash)('sha256').update(email).digest('hex'),
            amount,
            currency: 'EUR',
            description,
            account: String(transaction.account || '').slice(0, 120),
            status: 'unconfirmed',
        },
    };
}
//# sourceMappingURL=push-payload.helper.js.map