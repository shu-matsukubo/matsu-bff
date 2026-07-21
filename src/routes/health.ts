import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi';
import type { AppEnv } from '../types/app.js';

const HealthResponseSchema = z
  .object({
    status: z.literal('ok'),
  })
  .openapi('HealthResponse');

const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  tags: ['System'],
  summary: 'Check BFF health',
  responses: {
    200: {
      description: 'The BFF is healthy.',
      content: {
        'application/json': {
          schema: HealthResponseSchema,
        },
      },
    },
  },
});

export const registerHealthRoutes = (app: OpenAPIHono<AppEnv>): void => {
  app.openapi(healthRoute, (c) => c.json({ status: 'ok' }, 200));
};
