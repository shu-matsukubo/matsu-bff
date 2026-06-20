import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import { config } from '../config.js';
import { getSession } from '../services/sessionStore.js';
import type { Session } from '../types/session.js';

export type SessionVariables = {
  sessionId: string;
  session: Session;
};

export const setSessionCookie = (c: Context, sessionId: string): void => {
  setCookie(c, config.sessionCookieName, sessionId, {
    path: '/',
    maxAge: config.sessionTtlSeconds,
    httpOnly: true,
    sameSite: 'Lax',
    secure: config.cookieSecure,
  });
};

export const clearSessionCookie = (c: Context): void => {
  deleteCookie(c, config.sessionCookieName, {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  });
};

export const getSessionId = (c: Context): string | undefined =>
  getCookie(c, config.sessionCookieName);

export const requireSession = createMiddleware<{ Variables: SessionVariables }>(async (c, next) => {
  const sessionId = getSessionId(c);

  if (!sessionId) {
    return c.json({ message: 'Unauthenticated.' }, 401);
  }

  const session = await getSession(sessionId);

  if (!session) {
    clearSessionCookie(c);
    return c.json({ message: 'Unauthenticated.' }, 401);
  }

  c.set('sessionId', sessionId);
  c.set('session', session);
  await next();
});
