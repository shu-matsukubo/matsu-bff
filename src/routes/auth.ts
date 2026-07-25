import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { config } from '../config.js';
import {
  clearAuthorizationStateCookie,
  clearSessionCookie,
  getAuthorizationStateCookie,
  getSessionId,
  requireSession,
  setAuthorizationStateCookie,
  setSessionCookie,
} from '../middleware/session.js';
import {
  AuthenticatedResponseSchema,
  AuthRequestSchema,
  LoggedOutResponseSchema,
} from '../schemas/auth.js';
import { errorResponse, validationErrorResponse } from '../schemas/common.js';
import * as authClient from '../services/authClient.js';
import {
  consumeAuthorizationFlow,
  startAuthorizationFlow,
} from '../services/authorizationFlowStore.js';
import { refreshSession } from '../services/sessionRefresh.js';
import { createSession, deleteSession } from '../services/sessionStore.js';
import type { AppEnv } from '../types/app.js';
import { authorizationErrorPage } from '../views/authorizationError.js';

const sessionSecurity = [{ SessionCookie: [] }];

const redirectResponse = (description: string) => ({
  description,
  headers: {
    Location: {
      description: 'Redirect destination.',
      schema: {
        type: 'string' as const,
        format: 'uri',
      },
    },
  },
});

const htmlErrorResponse = (description: string) => ({
  description,
  content: {
    'text/html': {
      schema: z.string(),
    },
  },
});

const setAuthorizationErrorHeaders = (c: Context): void => {
  c.header('Cache-Control', 'no-store');
  c.header(
    'Content-Security-Policy',
    "default-src 'none'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
  );
  c.header('Referrer-Policy', 'no-referrer');
  c.header('X-Frame-Options', 'DENY');
};

const beginLoginRoute = createRoute({
  method: 'get',
  path: '/auth/login',
  tags: ['Authentication'],
  summary: 'Start the authorization code login flow',
  responses: {
    302: redirectResponse('Redirect to the authentication server.'),
    502: htmlErrorResponse('A retry page is shown when the authorization flow cannot be started.'),
  },
});

const callbackRoute = createRoute({
  method: 'get',
  path: '/auth/callback',
  tags: ['Authentication'],
  summary: 'Complete the authorization code login flow',
  request: {
    query: z.object({
      code: z.string().min(1),
      state: z.string().min(1),
    }),
  },
  responses: {
    302: redirectResponse('Login succeeded and the browser returns to the frontend.'),
    400: htmlErrorResponse(
      'A retry page is shown for an invalid or expired authorization response.'
    ),
    502: htmlErrorResponse(
      'A retry page is shown when the authentication service cannot complete the login.'
    ),
  },
});

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
    502: errorResponse(
      'The authentication service is unavailable or returned an invalid response.'
    ),
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
    502: errorResponse(
      'The authentication service is unavailable or returned an invalid response.'
    ),
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
  app.openapi(beginLoginRoute, async c => {
    try {
      const flow = await startAuthorizationFlow();
      setAuthorizationStateCookie(c, flow.state);
      return c.redirect(flow.authorizationUrl, 302);
    } catch (error) {
      console.error('Could not start the authorization flow.', error);
      setAuthorizationErrorHeaders(c);
      return c.html(authorizationErrorPage, 502);
    }
  });

  app.openapi(callbackRoute, async c => {
    const { code, state } = c.req.valid('query');
    const browserState = getAuthorizationStateCookie(c);

    clearAuthorizationStateCookie(c);

    if (browserState !== state) {
      setAuthorizationErrorHeaders(c);
      return c.html(authorizationErrorPage, 400);
    }

    const flow = await consumeAuthorizationFlow(state);

    if (!flow) {
      setAuthorizationErrorHeaders(c);
      return c.html(authorizationErrorPage, 400);
    }

    try {
      const tokens = await authClient.exchangeAuthorizationCode(code, flow.codeVerifier);
      const sessionId = await createSession(tokens);
      setSessionCookie(c, sessionId);
      return c.redirect(config.frontendOrigin, 302);
    } catch (error) {
      console.error('Could not complete the authorization flow.', error);
      setAuthorizationErrorHeaders(c);
      return c.html(authorizationErrorPage, 502);
    }
  });

  app.openapi(sessionRoute, c => c.json({ authenticated: true as const }, 200));

  app.openapi(loginRoute, async c => {
    const tokens = await authClient.login(c.req.valid('json'));
    const sessionId = await createSession(tokens);
    setSessionCookie(c, sessionId);
    return c.json({ authenticated: true as const }, 200);
  });

  app.openapi(registerRoute, async c => {
    const tokens = await authClient.register(c.req.valid('json'));
    const sessionId = await createSession(tokens);
    setSessionCookie(c, sessionId);
    return c.json({ authenticated: true as const }, 200);
  });

  app.openapi(refreshRoute, async c => {
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

  app.openapi(logoutRoute, async c => {
    const sessionId = getSessionId(c);

    if (sessionId) {
      await deleteSession(sessionId);
    }

    clearSessionCookie(c);
    return c.json({ authenticated: false as const }, 200);
  });
};
