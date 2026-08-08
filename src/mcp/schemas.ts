import { z } from 'zod';

const dateOnlySchema = z.string().regex(/^\d{2}-\d{2}-\d{4}$/, 'Expected date format dd-MM-yyyy');

export const emptyInputSchema = z.object({}).strict();

export const listAccountsInputSchema = z
  .object({
    calculateBalance: z.boolean().optional().default(true),
  })
  .strict();

export const getCategoryInputSchema = z
  .object({
    categoryName: z.string().trim().min(1),
  })
  .strict();

export const getMovementInputSchema = z
  .object({
    movementId: z.string().trim().min(1),
  })
  .strict();

export const listTransactionsInputSchema = z
  .object({
    fromDate: dateOnlySchema.optional(),
    toDate: dateOnlySchema.optional(),
    account: z.string().trim().min(1).optional(),
    category: z.string().trim().min(1).optional(),
    type: z.enum(['in', 'out']).optional(),
    status: z.string().trim().min(1).optional(),
    limit: z.number().int().positive().max(200).optional().default(200),
    offset: z.number().int().nonnegative().optional().default(0),
  })
  .strict();

export const listTransactionsDeltaInputSchema = z
  .object({
    since: z.iso.datetime({ offset: true }),
  })
  .strict();

export const monthlyAggregationsInputSchema = z
  .object({
    fromDate: dateOnlySchema.optional(),
    toDate: dateOnlySchema.optional(),
  })
  .strict();

export const dataOutputSchema = z.object({
  data: z.unknown(),
});
