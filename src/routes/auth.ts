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
  SessionStateResponseSchema,
} from '../schemas/auth.js';
import { errorResponse, validationErrorResponse } from '../schemas/common.js';
import * as authClient from '../services/authClient.js';
import {
  consumeAuthorizationFlow,
  startAuthorizationFlow,
  type OAuthResource,
} from '../services/authorizationFlowStore.js';
import { refreshSessionResource } from '../services/sessionRefresh.js';
import {
  createSession,
  deleteSession,
  deleteSessionResource,
  getSession,
  saveSessionResource,
} from '../services/sessionStore.js';
import type { AppEnv } from '../types/app.js';
import type { AuthTokens, Session, SessionResource } from '../types/session.js';
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

const resourceConnections = (session: Session | null) => ({
  matsuApi: session?.matsuApi !== undefined,
  toolbox: session?.toolbox !== undefined,
  arcade: session?.arcade !== undefined,
});

const sessionState = (session: Session | null) => ({
  authenticated: session !== null,
  resources: resourceConnections(session),
});

const authenticatedState = (session: Session) => ({
  authenticated: true as const,
  resources: resourceConnections(session),
});

const saveBrowserResource = async (
  c: Context,
  resource: SessionResource,
  tokens: AuthTokens
): Promise<Session> => {
  const existingSessionId = getSessionId(c);

  if (existingSessionId) {
    const existingSession = await getSession(existingSessionId);

    if (existingSession) {
      const session = await saveSessionResource(
        existingSessionId,
        existingSession,
        resource,
        tokens
      );
      setSessionCookie(c, existingSessionId);
      return session;
    }
  }

  const sessionId = await createSession(tokens, resource);
  const session = await getSession(sessionId);

  if (!session) {
    throw new Error('The browser session could not be created.');
  }

  setSessionCookie(c, sessionId);
  return session;
};

const beginAuthorization = async (c: Context, resource: OAuthResource): Promise<Response> => {
  try {
    const flow = await startAuthorizationFlow(resource);
    setAuthorizationStateCookie(c, flow.state);
    return c.redirect(flow.authorizationUrl, 302);
  } catch {
    console.error('Could not start the authorization flow.');
    setAuthorizationErrorHeaders(c);
    return c.html(authorizationErrorPage, 502);
  }
};

const beginLoginRoute = createRoute({
  method: 'get',
  path: '/auth/login',
  tags: ['Authentication'],
  summary: 'Start the matsu API authorization code login flow',
  responses: {
    302: redirectResponse('Redirect to the authentication server.'),
    502: htmlErrorResponse('A retry page is shown when the authorization flow cannot be started.'),
  },
});

const beginToolboxLoginRoute = createRoute({
  method: 'get',
  path: '/auth/toolbox/login',
  tags: ['Authentication'],
  summary: 'Connect Toolbox with Authorization Code and PKCE',
  responses: {
    302: redirectResponse('Redirect to the authentication server for Toolbox authorization.'),
    502: htmlErrorResponse('A retry page is shown when the authorization flow cannot be started.'),
  },
});

const callbackRoute = createRoute({
  method: 'get',
  path: '/auth/callback',
  tags: ['Authentication'],
  summary: 'Complete an authorization code connection flow',
  request: {
    query: z.object({
      code: z.string().min(1),
      state: z.string().min(1),
    }),
  },
  responses: {
    302: redirectResponse(
      'The resource connection succeeded and the browser returns to the frontend.'
    ),
    400: htmlErrorResponse(
      'A retry page is shown for an invalid or expired authorization response.'
    ),
    502: htmlErrorResponse(
      'A retry page is shown when the authentication service cannot complete the connection.'
    ),
  },
});

const sessionRoute = createRoute({
  method: 'get',
  path: '/auth/session',
  tags: ['Authentication'],
  summary: 'Check the browser session and resource connections',
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
  summary: 'Log in to matsu API and create or merge a browser session',
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
  summary: 'Register with matsu API and create or merge a browser session',
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

const arcadeLoginRoute = createRoute({
  method: 'post',
  path: '/auth/arcade/login',
  tags: ['Authentication'],
  summary: 'Log in to Arcade without exposing Arcade tokens to the browser',
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
      description: 'Arcade login succeeded.',
      content: { 'application/json': { schema: AuthenticatedResponseSchema } },
    },
    400: validationErrorResponse,
    401: errorResponse('The Arcade credentials are invalid.'),
    502: errorResponse('Arcade authentication is unavailable or returned an invalid response.'),
  },
});

const arcadeRegisterRoute = createRoute({
  method: 'post',
  path: '/auth/arcade/register',
  tags: ['Authentication'],
  summary: 'Register with Arcade without exposing Arcade tokens to the browser',
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
      description: 'Arcade registration succeeded.',
      content: { 'application/json': { schema: AuthenticatedResponseSchema } },
    },
    400: validationErrorResponse,
    409: errorResponse('The Arcade email address is already registered.'),
    502: errorResponse('Arcade authentication is unavailable or returned an invalid response.'),
  },
});

const refreshRoute = createRoute({
  method: 'post',
  path: '/auth/refresh',
  tags: ['Authentication'],
  summary: 'Refresh the matsu API server-side access token',
  security: sessionSecurity,
  middleware: [requireSession] as const,
  responses: {
    200: {
      description: 'The matsu API token was refreshed.',
      content: {
        'application/json': {
          schema: AuthenticatedResponseSchema,
        },
      },
    },
    401: errorResponse('The matsu API connection could not be refreshed.'),
  },
});

const arcadeDisconnectRoute = createRoute({
  method: 'post',
  path: '/auth/arcade/disconnect',
  tags: ['Authentication'],
  summary: 'Disconnect Arcade while preserving other resource connections',
  responses: {
    200: {
      description: 'The local Arcade connection was removed.',
      content: { 'application/json': { schema: SessionStateResponseSchema } },
    },
  },
});

const logoutRoute = createRoute({
  method: 'post',
  path: '/auth/logout',
  tags: ['Authentication'],
  summary: 'Delete the complete browser session',
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
  app.openapi(beginLoginRoute, c => beginAuthorization(c, 'matsuApi'));

  app.openapi(beginToolboxLoginRoute, c => beginAuthorization(c, 'toolbox'));

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
      await saveBrowserResource(c, flow.resource, tokens);
      return c.redirect(config.frontendOrigin, 302);
    } catch {
      console.error('Could not complete the authorization flow.');
      setAuthorizationErrorHeaders(c);
      return c.html(authorizationErrorPage, 502);
    }
  });

  app.openapi(sessionRoute, c => c.json(authenticatedState(c.get('session')), 200));

  app.openapi(loginRoute, async c => {
    const tokens = await authClient.login(c.req.valid('json'));
    const session = await saveBrowserResource(c, 'matsuApi', tokens);
    return c.json(authenticatedState(session), 200);
  });

  app.openapi(registerRoute, async c => {
    const tokens = await authClient.register(c.req.valid('json'));
    const session = await saveBrowserResource(c, 'matsuApi', tokens);
    return c.json(authenticatedState(session), 200);
  });

  app.openapi(arcadeLoginRoute, async c => {
    const tokens = await authClient.arcadeLogin(c.req.valid('json'));
    const session = await saveBrowserResource(c, 'arcade', tokens);
    return c.json(authenticatedState(session), 200);
  });

  app.openapi(arcadeRegisterRoute, async c => {
    const tokens = await authClient.arcadeRegister(c.req.valid('json'));
    const session = await saveBrowserResource(c, 'arcade', tokens);
    return c.json(authenticatedState(session), 200);
  });

  app.openapi(refreshRoute, async c => {
    const sessionId = c.get('sessionId');
    const session = c.get('session');

    try {
      const refreshed = await refreshSessionResource(sessionId, session, 'matsuApi');
      return c.json(authenticatedState(refreshed), 200);
    } catch {
      const remaining = await deleteSessionResource(sessionId, session, 'matsuApi');

      if (!remaining) {
        clearSessionCookie(c);
      }

      return c.json({ message: 'Unauthenticated.' }, 401);
    }
  });

  app.openapi(arcadeDisconnectRoute, async c => {
    const sessionId = getSessionId(c);

    if (!sessionId) {
      clearSessionCookie(c);
      return c.json(sessionState(null), 200);
    }

    const session = await getSession(sessionId);

    if (!session) {
      clearSessionCookie(c);
      return c.json(sessionState(null), 200);
    }

    if (session.arcade) {
      try {
        await authClient.revokeArcade(session.arcade.refreshToken);
      } catch {
        console.warn('Arcade token revocation could not be completed.');
      }
    }

    const remaining = await deleteSessionResource(sessionId, session, 'arcade');

    if (!remaining) {
      clearSessionCookie(c);
    }

    return c.json(sessionState(remaining), 200);
  });

  app.openapi(logoutRoute, async c => {
    const sessionId = getSessionId(c);

    if (sessionId) {
      await deleteSession(sessionId);
    }

    clearSessionCookie(c);
    return c.json(
      {
        authenticated: false as const,
        resources: { matsuApi: false as const, toolbox: false as const, arcade: false as const },
      },
      200
    );
  });
};
