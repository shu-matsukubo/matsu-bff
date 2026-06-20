import type { Context } from 'hono';
import { Hono } from 'hono';
import {
  clearSessionCookie,
  getSessionId,
  requireSession,
  setSessionCookie,
  type SessionVariables,
} from '../middleware/session.js';
import * as authClient from '../services/authClient.js';
import { createSession, deleteSession } from '../services/sessionStore.js';
import { refreshSession } from '../services/sessionRefresh.js';
import { AuthError } from '../types/auth-error.js';
import type { AuthTokens } from '../types/session.js';

export const authRoutes = new Hono<{ Variables: SessionVariables }>();

const handleAuthError = (c: Context, error: unknown) => {
  if (error instanceof AuthError) {
    return c.json(
      (error.data as Record<string, unknown> | null) ?? { message: 'Authentication service error.' },
      error.statusCode as 401,
    );
  }

  throw error;
};

const handleLoginLike = async (
  c: Context,
  authFn: (body: unknown) => Promise<AuthTokens>,
) => {
  try {
    const body = await c.req.json();
    const tokens = await authFn(body);
    const sessionId = await createSession(tokens);
    setSessionCookie(c, sessionId);
    return c.json({ authenticated: true });
  } catch (error) {
    return handleAuthError(c, error);
  }
};

authRoutes.get('/session', requireSession, (c) => c.json({ authenticated: true }));

authRoutes.post('/login', (c) => handleLoginLike(c, authClient.login));

authRoutes.post('/register', (c) => handleLoginLike(c, authClient.register));

authRoutes.post('/refresh', requireSession, async (c) => {
  const sessionId = c.get('sessionId');
  const session = c.get('session');

  try {
    await refreshSession(sessionId, session);
    return c.json({ authenticated: true });
  } catch {
    await deleteSession(sessionId);
    clearSessionCookie(c);
    return c.json({ message: 'Unauthenticated.' }, 401);
  }
});

authRoutes.post('/logout', async (c) => {
  const sessionId = getSessionId(c);

  if (sessionId) {
    await deleteSession(sessionId);
  }

  clearSessionCookie(c);
  return c.json({ authenticated: false });
});
