import { z } from '@hono/zod-openapi';

const DateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .openapi({ example: '2026-07-20' });

const DateRangeSchema = z
  .object({
    start_date: DateSchema,
    end_date: DateSchema,
  })
  .refine(({ start_date, end_date }) => start_date <= end_date, {
    message: 'start_date must be before or equal to end_date.',
    path: ['end_date'],
  });

export const ExpenseGroupBySchema = z
  .enum(['category', 'payment_method', 'date'])
  .openapi('ExpenseGroupBy');

export const ExpenseSummaryQuerySchema = DateRangeSchema.extend({
  group_by: ExpenseGroupBySchema.optional().openapi({ default: 'category' }),
});

export const ExpenseHistoryQuerySchema = DateRangeSchema.extend({
  category_id: z.string().min(1),
});

export const ExpenseSummarySchema = z
  .object({
    total_amount: z.number(),
    total_point: z.number(),
    net_amount: z.number(),
    transaction_count: z.number().int().nonnegative(),
    category_id: z.string().optional(),
    category_name: z.string().optional(),
    payment_method_id: z.string().optional(),
    payment_method_name: z.string().optional(),
    initial_balance: z.number().optional(),
    remaining_balance: z.number().optional(),
    date: DateSchema.optional(),
  })
  .openapi('ExpenseSummary');

export const FixedCostSchema = z
  .object({
    name: z.string(),
    payment_date: DateSchema,
    amount: z.number(),
  })
  .openapi('FixedCost');

export const ExpenseSummaryMetaSchema = z
  .object({
    total_net_amount: z.number(),
    fixed_cost_net_amount: z.number().optional(),
    fixed_costs: z.array(FixedCostSchema),
  })
  .openapi('ExpenseSummaryMeta');

export const ExpenseSummaryResponseSchema = z
  .object({
    data: z.array(ExpenseSummarySchema),
    meta: ExpenseSummaryMetaSchema,
  })
  .openapi('ExpenseSummaryResponse');

export const ExpenseHistorySchema = z
  .object({
    net_amount: z.number(),
    memo: z.string().nullable(),
    date: DateSchema,
  })
  .openapi('ExpenseHistory');

export const ExpenseHistoryResponseSchema = z
  .array(ExpenseHistorySchema)
  .openapi('ExpenseHistoryResponse');

export const ExpensePaymentMethodSchema = z
  .object({
    id: z.string(),
    name: z.string(),
  })
  .openapi('ExpensePaymentMethod');

export const ExpensePaymentMethodListSchema = z
  .array(ExpensePaymentMethodSchema)
  .openapi('ExpensePaymentMethodList');

export const ExpenseCategorySchema = z
  .object({
    id: z.string(),
    name: z.string(),
  })
  .openapi('ExpenseCategory');

export const ExpenseCategoryListSchema = z
  .array(ExpenseCategorySchema)
  .openapi('ExpenseCategoryList');

export const ExpenseCreateRequestSchema = z
  .object({
    amount: z.number().int().nonnegative(),
    point_amount: z.number().int().nonnegative(),
    payment_method_id: z.string().min(1),
    category_id: z.string().min(1),
    memo: z.string().max(255),
    date: DateSchema,
  })
  .openapi('ExpenseCreateRequest');

export const ExpenseCreatedResponseSchema = z
  .object({
    created: z.literal(true),
  })
  .openapi('ExpenseCreatedResponse');
