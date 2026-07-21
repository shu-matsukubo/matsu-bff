import { swaggerUI } from '@hono/swagger-ui';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { config } from './config.js';
import { registerApiRoutes } from './routes/api.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerHealthRoutes } from './routes/health.js';
import { AuthError } from './types/auth-error.js';
import type { AppEnv } from './types/app.js';
import { getErrorMessage, HttpError, type PublicErrorStatus } from './types/http-error.js';

export const openApiConfig = {
  openapi: '3.0.0' as const,
  info: {
    version: '0.1.0',
    title: 'matsu BFF API',
    description: 'Browser-facing API contract for the matsu application.',
  },
  servers: [{ url: 'http://localhost:18082', description: 'Local development' }],
  tags: [
    { name: 'System' },
    { name: 'Authentication' },
    { name: 'Expenses' },
    { name: 'Expense masters' },
  ],
};

const errorResponse = (c: Context, status: PublicErrorStatus, message: string): Response => {
  switch (status) {
    case 400:
      return c.json({ message }, 400);
    case 401:
      return c.json({ message }, 401);
    case 409:
      return c.json({ message }, 409);
    case 422:
      return c.json({ message }, 422);
    case 502:
      return c.json({ message }, 502);
  }
};

export const app = new OpenAPIHono<AppEnv>({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json(
        {
          message: 'Request validation failed.',
          issues: result.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
        400,
      );
    }
  },
});

app.use(
  '*',
  cors({
    origin: config.frontendOrigin,
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['content-type', 'accept'],
  }),
);

app.openAPIRegistry.registerComponent('securitySchemes', 'SessionCookie', {
  type: 'apiKey',
  in: 'cookie',
  name: config.sessionCookieName,
  description: 'HttpOnly browser session cookie managed by the BFF.',
});

registerHealthRoutes(app);
registerAuthRoutes(app);
registerApiRoutes(app);

app.doc('/openapi.json', openApiConfig);
app.get('/docs', swaggerUI({ url: '/openapi.json' }));

app.notFound((c) => c.json({ message: 'Not found.' }, 404));

app.onError((error, c) => {
  if ((error instanceof HTTPException && error.status === 400) || error instanceof SyntaxError) {
    return c.json(
      {
        message: 'Request validation failed.',
        issues: [{ path: 'body', message: 'The request body must be valid JSON.' }],
      },
      400,
    );
  }

  if (error instanceof HttpError) {
    return errorResponse(c, error.statusCode, error.message);
  }

  if (error instanceof AuthError) {
    const status: PublicErrorStatus =
      error.statusCode === 400 ||
      error.statusCode === 401 ||
      error.statusCode === 409 ||
      error.statusCode === 422
        ? error.statusCode
        : 502;

    return errorResponse(
      c,
      status,
      getErrorMessage(error.data, 'Authentication service error.'),
    );
  }

  console.error(error);
  return c.json({ message: 'Internal server error.' }, 500);
});
