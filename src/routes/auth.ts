import { createRoute, type OpenAPIHono } from '@hono/zod-openapi';
import {
  clearSessionCookie,
  getSessionId,
  requireSession,
  setSessionCookie,
} from '../middleware/session.js';
import {
  AuthenticatedResponseSchema,
  AuthRequestSchema,
  LoggedOutResponseSchema,
} from '../schemas/auth.js';
import { errorResponse, validationErrorResponse } from '../schemas/common.js';
import * as authClient from '../services/authClient.js';
import { refreshSession } from '../services/sessionRefresh.js';
import { createSession, deleteSession } from '../services/sessionStore.js';
import type { AppEnv } from '../types/app.js';

const sessionSecurity = [{ SessionCookie: [] }];

const sessionRoute = createRoute({
  method: 'get',
  path: '/auth/session',
  tags: ['Authentication'],
  summary: 'Check the browser session',
  security: sessionSecurity,
  middleware: [requireSession] as const,
  responses: {
    200: {
      description: 'The browser session is authenticated.',
      content: {
        'application/json': {
          schema: AuthenticatedResponseSchema,
        },
      },
    },
    401: errorResponse('The browser session is missing or expired.'),
  },
});

const loginRoute = createRoute({
  method: 'post',
  path: '/auth/login',
  tags: ['Authentication'],
  summary: 'Log in and create a browser session',
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: AuthRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Login succeeded.',
      content: {
        'application/json': {
          schema: AuthenticatedResponseSchema,
        },
      },
    },
    400: validationErrorResponse,
    401: errorResponse('The credentials are invalid.'),
    502: errorResponse('The authentication service is unavailable or returned an invalid response.'),
  },
});

const registerRoute = createRoute({
  method: 'post',
  path: '/auth/register',
  tags: ['Authentication'],
  summary: 'Register and create a browser session',
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: AuthRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Registration succeeded.',
      content: {
        'application/json': {
          schema: AuthenticatedResponseSchema,
        },
      },
    },
    400: validationErrorResponse,
    409: errorResponse('The email address is already registered.'),
    502: errorResponse('The authentication service is unavailable or returned an invalid response.'),
  },
});

const refreshRoute = createRoute({
  method: 'post',
  path: '/auth/refresh',
  tags: ['Authentication'],
  summary: 'Refresh the server-side access token',
  security: sessionSecurity,
  middleware: [requireSession] as const,
  responses: {
    200: {
      description: 'The token was refreshed.',
      content: {
        'application/json': {
          schema: AuthenticatedResponseSchema,
        },
      },
    },
    401: errorResponse('The session could not be refreshed.'),
  },
});

const logoutRoute = createRoute({
  method: 'post',
  path: '/auth/logout',
  tags: ['Authentication'],
  summary: 'Delete the browser session',
  responses: {
    200: {
      description: 'Logout completed.',
      content: {
        'application/json': {
          schema: LoggedOutResponseSchema,
        },
      },
    },
  },
});

export const registerAuthRoutes = (app: OpenAPIHono<AppEnv>): void => {
  app.openapi(sessionRoute, (c) => c.json({ authenticated: true as const }, 200));

  app.openapi(loginRoute, async (c) => {
    const tokens = await authClient.login(c.req.valid('json'));
    const sessionId = await createSession(tokens);
    setSessionCookie(c, sessionId);
    return c.json({ authenticated: true as const }, 200);
  });

  app.openapi(registerRoute, async (c) => {
    const tokens = await authClient.register(c.req.valid('json'));
    const sessionId = await createSession(tokens);
    setSessionCookie(c, sessionId);
    return c.json({ authenticated: true as const }, 200);
  });

  app.openapi(refreshRoute, async (c) => {
    const sessionId = c.get('sessionId');
    const session = c.get('session');

    try {
      await refreshSession(sessionId, session);
      return c.json({ authenticated: true as const }, 200);
    } catch {
      await deleteSession(sessionId);
      clearSessionCookie(c);
      return c.json({ message: 'Unauthenticated.' }, 401);
    }
  });

  app.openapi(logoutRoute, async (c) => {
    const sessionId = getSessionId(c);

    if (sessionId) {
      await deleteSession(sessionId);
    }

    clearSessionCookie(c);
    return c.json({ authenticated: false as const }, 200);
  });
};
