import http from 'node:http';
import { config } from './config.js';
import * as authClient from './authClient.js';
import {
  clearSessionCookie,
  parseCookies,
  readJsonBody,
  sendJson,
  setCorsHeaders,
  setSessionCookie,
} from './httpUtil.js';
import { createSession, deleteSession, getSession, saveSession } from './sessionStore.js';

const getSessionId = (request) => {
  const cookies = parseCookies(request.headers.cookie);
  return cookies[config.sessionCookieName] ?? null;
};

const requireSession = async (request, response) => {
  const sessionId = getSessionId(request);

  if (!sessionId) {
    sendJson(response, 401, { message: 'Unauthenticated.' });
    return null;
  }

  const session = await getSession(sessionId);

  if (!session) {
    clearSessionCookie(response);
    sendJson(response, 401, { message: 'Unauthenticated.' });
    return null;
  }

  return { sessionId, session };
};

const refreshSession = async (sessionId, session) => {
  const tokens = await authClient.refresh(session.refreshToken);
  return saveSession(sessionId, tokens);
};

const handleAuthError = (response, error) => {
  response.statusCode = error.statusCode ?? 502;
  sendJson(response, response.statusCode, error.data ?? { message: 'Authentication service error.' });
};

const handleLoginLike = async (request, response, authFn) => {
  try {
    const body = await readJsonBody(request);
    const tokens = await authFn(body);
    const sessionId = await createSession(tokens);
    setSessionCookie(response, sessionId);
    sendJson(response, 200, { authenticated: true });
  } catch (error) {
    handleAuthError(response, error);
  }
};

const readProxyBody = async (request) => {
  if (['GET', 'HEAD'].includes(request.method)) {
    return undefined;
  }

  return readJsonBody(request);
};

const proxyToBackend = async (request, session, parsedBody) => {
  const pathAndQuery = request.url.slice('/api'.length) || '/';
  const targetUrl = `${config.backendApiBaseUrl}${pathAndQuery}`;
  const headers = {
    accept: request.headers.accept ?? 'application/json',
    authorization: `Bearer ${session.accessToken}`,
  };

  const hasBody = !['GET', 'HEAD'].includes(request.method);
  let body;

  if (hasBody && parsedBody != null) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(parsedBody);
  }

  return fetch(targetUrl, {
    method: request.method,
    headers,
    body,
  });
};

const forwardBackendResponse = async (backendResponse, response) => {
  const contentType = backendResponse.headers.get('content-type') ?? 'application/json; charset=utf-8';
  const text = await backendResponse.text();

  response.writeHead(backendResponse.status, {
    'content-type': contentType,
  });
  response.end(text);
};

const handleApiProxy = async (request, response) => {
  const current = await requireSession(request, response);

  if (!current) {
    return;
  }

  const parsedBody = await readProxyBody(request);
  let backendResponse = await proxyToBackend(request, current.session, parsedBody);

  if (backendResponse.status === 401) {
    try {
      const refreshed = await refreshSession(current.sessionId, current.session);
      backendResponse = await proxyToBackend(request, refreshed, parsedBody);
    } catch {
      await deleteSession(current.sessionId);
      clearSessionCookie(response);
      sendJson(response, 401, { message: 'Unauthenticated.' });
      return;
    }
  }

  await forwardBackendResponse(backendResponse, response);
};

const server = http.createServer(async (request, response) => {
  setCorsHeaders(response);

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host}`);

  try {
    if (request.method === 'GET' && url.pathname === '/health') {
      sendJson(response, 200, { status: 'ok' });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/auth/session') {
      const current = await requireSession(request, response);

      if (current) {
        sendJson(response, 200, { authenticated: true });
      }

      return;
    }

    if (request.method === 'POST' && url.pathname === '/auth/login') {
      await handleLoginLike(request, response, authClient.login);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/auth/register') {
      await handleLoginLike(request, response, authClient.register);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/auth/refresh') {
      const current = await requireSession(request, response);

      if (!current) {
        return;
      }

      try {
        await refreshSession(current.sessionId, current.session);
        sendJson(response, 200, { authenticated: true });
      } catch {
        await deleteSession(current.sessionId);
        clearSessionCookie(response);
        sendJson(response, 401, { message: 'Unauthenticated.' });
      }

      return;
    }

    if (request.method === 'POST' && url.pathname === '/auth/logout') {
      const sessionId = getSessionId(request);

      if (sessionId) {
        await deleteSession(sessionId);
      }

      clearSessionCookie(response);
      sendJson(response, 200, { authenticated: false });
      return;
    }

    if (url.pathname.startsWith('/api/')) {
      await handleApiProxy(request, response);
      return;
    }

    sendJson(response, 404, { message: 'Not found.' });
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { message: 'Internal server error.' });
  }
});

server.listen(config.port, '0.0.0.0', () => {
  console.log(`Kakeibo BFF listening on :${config.port}`);
});
