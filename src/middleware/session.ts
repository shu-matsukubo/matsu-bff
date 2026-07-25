import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import { config } from '../config.js';
import { getSession } from '../services/sessionStore.js';
import type { Session } from '../types/session.js';

export interface SessionVariables {
  sessionId: string;
  session: Session;
}

const authorizationStateCookieName = `${config.sessionCookieName}-oauth-state`;

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

export const setAuthorizationStateCookie = (c: Context, state: string): void => {
  setCookie(c, authorizationStateCookieName, state, {
    path: '/auth/callback',
    maxAge: config.authorizationFlowTtlSeconds,
    httpOnly: true,
    sameSite: 'Lax',
    secure: config.cookieSecure,
  });
};

export const getAuthorizationStateCookie = (c: Context): string | undefined =>
  getCookie(c, authorizationStateCookieName);

export const clearAuthorizationStateCookie = (c: Context): void => {
  deleteCookie(c, authorizationStateCookieName, {
    path: '/auth/callback',
    httpOnly: true,
    sameSite: 'Lax',
    secure: config.cookieSecure,
  });
};

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
