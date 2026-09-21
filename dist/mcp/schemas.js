"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataOutputSchema = exports.monthlyAggregationsInputSchema = exports.listTransactionsDeltaInputSchema = exports.listTransactionsInputSchema = exports.getMovementInputSchema = exports.getCategoryInputSchema = exports.listAccountsInputSchema = exports.emptyInputSchema = void 0;
const zod_1 = require("zod");
const dateOnlySchema = zod_1.z.string().regex(/^\d{2}-\d{2}-\d{4}$/, 'Expected date format dd-MM-yyyy');
exports.emptyInputSchema = zod_1.z.object({}).strict();
exports.listAccountsInputSchema = zod_1.z
    .object({
    calculateBalance: zod_1.z.boolean().optional().default(true),
})
    .strict();
exports.getCategoryInputSchema = zod_1.z
    .object({
    categoryName: zod_1.z.string().trim().min(1),
})
    .strict();
exports.getMovementInputSchema = zod_1.z
    .object({
    movementId: zod_1.z.string().trim().min(1),
})
    .strict();
exports.listTransactionsInputSchema = zod_1.z
    .object({
    fromDate: dateOnlySchema.optional(),
    toDate: dateOnlySchema.optional(),
    account: zod_1.z.string().trim().min(1).optional(),
    category: zod_1.z.string().trim().min(1).optional(),
    type: zod_1.z.enum(['in', 'out']).optional(),
    status: zod_1.z.string().trim().min(1).optional(),
    limit: zod_1.z.number().int().positive().max(200).optional().default(200),
    offset: zod_1.z.number().int().nonnegative().optional().default(0),
})
    .strict();
exports.listTransactionsDeltaInputSchema = zod_1.z
    .object({
    since: zod_1.z.iso.datetime({ offset: true }),
})
    .strict();
exports.monthlyAggregationsInputSchema = zod_1.z
    .object({
    fromDate: dateOnlySchema.optional(),
    toDate: dateOnlySchema.optional(),
})
    .strict();
exports.dataOutputSchema = zod_1.z.object({
    data: zod_1.z.unknown(),
});
//# sourceMappingURL=schemas.js.map