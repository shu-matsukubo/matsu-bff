import type { Context } from 'hono';
import type { z } from 'zod';
import { config } from '../config.js';
import { clearSessionCookie } from '../middleware/session.js';
import type { AppEnv } from '../types/app.js';
import { HttpError, getErrorMessage, type PublicErrorStatus } from '../types/http-error.js';
import type { Session } from '../types/session.js';
import { refreshSession } from './sessionRefresh.js';
import { deleteSession } from './sessionStore.js';

interface BackendRequest {
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Record<string, string | undefined>;
  body?: unknown;
}

const buildUrl = ({ path, query }: BackendRequest): string => {
  const baseUrl = config.backendApiBaseUrl.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${baseUrl}${normalizedPath}`);

  for (const [name, value] of Object.entries(query ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(name, value);
    }
  }

  return url.toString();
};

const fetchBackend = (session: Session, request: BackendRequest): Promise<Response> => {
  const headers: Record<string, string> = {
    accept: 'application/json',
    authorization: `Bearer ${session.accessToken}`,
  };

  if (request.body !== undefined) {
    headers['content-type'] = 'application/json';
  }

  return fetch(buildUrl(request), {
    method: request.method ?? 'GET',
    headers,
    body: request.body === undefined ? undefined : JSON.stringify(request.body),
  });
};

const readResponseData = async (response: Response): Promise<unknown> => {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const publicStatus = (status: number): PublicErrorStatus => {
  if (status === 400 || status === 401 || status === 409 || status === 422) {
    return status;
  }

  return 502;
};

export const requestBackend = async (
  c: Context<AppEnv>,
  request: BackendRequest
): Promise<unknown> => {
  const sessionId = c.get('sessionId');
  const session = c.get('session');
  let response = await fetchBackend(session, request);

  if (response.status === 401) {
    try {
      const refreshedSession = await refreshSession(sessionId, session);
      response = await fetchBackend(refreshedSession, request);
    } catch {
      await deleteSession(sessionId);
      clearSessionCookie(c);
      throw new HttpError(401, 'Unauthenticated.');
    }
  }

  const data = await readResponseData(response);

  if (!response.ok) {
    throw new HttpError(
      publicStatus(response.status),
      getErrorMessage(data, `Backend API returned ${response.status}.`)
    );
  }

  return data;
};

export const parseBackendResponse = <Schema extends z.ZodType>(
  schema: Schema,
  data: unknown,
  operation: string
): z.output<Schema> => {
  const result = schema.safeParse(data);

  if (!result.success) {
    console.error(`Backend response contract violation: ${operation}`, result.error.issues);
    throw new HttpError(502, 'Backend API returned an invalid response.');
  }

  return result.data;
};
