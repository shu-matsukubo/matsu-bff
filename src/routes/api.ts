import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi';
import { requireSession } from '../middleware/session.js';
import { badRequestResponse, errorResponse } from '../schemas/common.js';
import {
  ExpenseCategoryListSchema,
  ExpenseCreateRequestSchema,
  ExpenseCreatedResponseSchema,
  ExpenseHistoryQuerySchema,
  ExpenseHistoryResponseSchema,
  ExpensePaymentMethodListSchema,
  ExpenseSummaryQuerySchema,
  ExpenseSummaryResponseSchema,
} from '../schemas/expenses.js';
import { requestUpstream } from '../services/upstreamClient.js';
import type { AppEnv } from '../types/app.js';

const sessionSecurity = [{ SessionCookie: [] }];
const protectedRoute = {
  security: sessionSecurity,
  middleware: [requireSession],
};
const protectedErrors = {
  400: badRequestResponse,
  401: errorResponse('The browser session is missing or expired.'),
  422: errorResponse('The backend rejected the request.'),
  502: errorResponse('The backend is unavailable or violated the BFF response contract.'),
};

const summaryRoute = createRoute({
  method: 'get',
  path: '/api/expenses/summary',
  tags: ['Expenses'],
  summary: 'Get an expense summary',
  ...protectedRoute,
  request: {
    query: ExpenseSummaryQuerySchema,
  },
  responses: {
    200: {
      description: 'Expense summary.',
      content: {
        'application/json': {
          schema: ExpenseSummaryResponseSchema,
        },
      },
    },
    ...protectedErrors,
  },
});

const historyRoute = createRoute({
  method: 'get',
  path: '/api/expenses/history',
  tags: ['Expenses'],
  summary: 'Get expense history for a category',
  ...protectedRoute,
  request: {
    query: ExpenseHistoryQuerySchema,
  },
  responses: {
    200: {
      description: 'Expense history.',
      content: {
        'application/json': {
          schema: ExpenseHistoryResponseSchema,
        },
      },
    },
    ...protectedErrors,
  },
});

const createExpenseRoute = createRoute({
  method: 'post',
  path: '/api/expenses',
  tags: ['Expenses'],
  summary: 'Create an expense',
  ...protectedRoute,
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: ExpenseCreateRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'The expense was created.',
      content: {
        'application/json': {
          schema: ExpenseCreatedResponseSchema,
        },
      },
    },
    ...protectedErrors,
  },
});

const paymentMethodsRoute = createRoute({
  method: 'get',
  path: '/api/payment-methods',
  tags: ['Expense masters'],
  summary: 'List active payment methods',
  ...protectedRoute,
  responses: {
    200: {
      description: 'Active payment methods.',
      content: {
        'application/json': {
          schema: ExpensePaymentMethodListSchema,
        },
      },
    },
    ...protectedErrors,
  },
});

const categoriesRoute = createRoute({
  method: 'get',
  path: '/api/categories',
  tags: ['Expense masters'],
  summary: 'List active expense categories',
  ...protectedRoute,
  responses: {
    200: {
      description: 'Active expense categories.',
      content: {
        'application/json': {
          schema: ExpenseCategoryListSchema,
        },
      },
    },
    ...protectedErrors,
  },
});

export const registerApiRoutes = (app: OpenAPIHono<AppEnv>): void => {
  app.openapi(summaryRoute, async c => {
    const query = c.req.valid('query');
    const data = await requestUpstream(c, {
      upstream: 'matsuApi',
      path: '/expenses',
      query: {
        mode: 'summary',
        start_date: query.start_date,
        end_date: query.end_date,
        group_by: query.group_by ?? 'category',
      },
      expectedStatus: 200,
      responseSchema: ExpenseSummaryResponseSchema,
      operation: 'expense summary',
    });

    return c.json(data, 200);
  });

  app.openapi(historyRoute, async c => {
    const query = c.req.valid('query');
    const data = await requestUpstream(c, {
      upstream: 'matsuApi',
      path: '/expenses',
      query: {
        mode: 'history',
        start_date: query.start_date,
        end_date: query.end_date,
        category_id: query.category_id,
      },
      expectedStatus: 200,
      responseSchema: ExpenseHistoryResponseSchema,
      operation: 'expense history',
    });

    return c.json(data, 200);
  });

  app.openapi(createExpenseRoute, async c => {
    await requestUpstream(c, {
      upstream: 'matsuApi',
      path: '/expenses',
      method: 'POST',
      body: c.req.valid('json'),
      expectedStatus: 201,
      responseSchema: z.unknown(),
      operation: 'create expense',
    });

    return c.json({ created: true as const }, 201);
  });

  app.openapi(paymentMethodsRoute, async c => {
    const data = await requestUpstream(c, {
      upstream: 'matsuApi',
      path: '/payment-methods',
      expectedStatus: 200,
      responseSchema: ExpensePaymentMethodListSchema,
      operation: 'payment method list',
    });
    return c.json(data, 200);
  });

  app.openapi(categoriesRoute, async c => {
    const data = await requestUpstream(c, {
      upstream: 'matsuApi',
      path: '/categories',
      expectedStatus: 200,
      responseSchema: ExpenseCategoryListSchema,
      operation: 'category list',
    });
    return c.json(data, 200);
  });
};
