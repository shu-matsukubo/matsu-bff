import type { Context } from 'hono';
import type { z } from 'zod';
import { config } from '../config.js';
import { clearSessionCookie } from '../middleware/session.js';
import type { AppEnv } from '../types/app.js';
import { getErrorMessage, HttpError, type PublicErrorStatus } from '../types/http-error.js';
import type { ResourceToken, SessionResource } from '../types/session.js';
import { refreshSessionResource } from './sessionRefresh.js';
import { deleteSessionResource } from './sessionStore.js';
import { runtime } from './runtime.js';

type UpstreamMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface UpstreamRequest<Schema extends z.ZodType> {
  upstream: SessionResource;
  path: string;
  method?: UpstreamMethod;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  expectedStatus: number;
  responseSchema: Schema;
  operation: string;
}

const baseUrls: Record<SessionResource, string> = {
  matsuApi: config.backendApiBaseUrl,
  toolbox: config.toolboxApiBaseUrl,
  arcade: config.arcadeApiBaseUrl,
};

const buildUrl = <Schema extends z.ZodType>({
  upstream,
  path,
  query,
}: UpstreamRequest<Schema>): string => {
  const baseUrl = baseUrls[upstream].replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${baseUrl}${normalizedPath}`);

  for (const [name, value] of Object.entries(query ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(name, String(value));
    }
  }

  return url.toString();
};

const fetchUpstream = async <Schema extends z.ZodType>(
  token: ResourceToken,
  request: UpstreamRequest<Schema>
): Promise<Response> => {
  const headers: Record<string, string> = {
    accept: 'application/json',
    authorization: `Bearer ${token.accessToken}`,
  };

  if (request.body !== undefined) {
    headers['content-type'] = 'application/json';
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.upstreamTimeoutMilliseconds);

  try {
    return await runtime.fetch(buildUrl(request), {
      method: request.method ?? 'GET',
      headers,
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
      signal: controller.signal,
    });
  } catch {
    throw new HttpError(502, 'Upstream service is unavailable.');
  } finally {
    clearTimeout(timeout);
  }
};

const readResponseData = async (
  response: Response
): Promise<{ data: unknown; isJson: boolean }> => {
  const text = await response.text();

  if (!text) {
    return { data: null, isJson: true };
  }

  try {
    return { data: JSON.parse(text) as unknown, isJson: true };
  } catch {
    return { data: null, isJson: false };
  }
};

const publicStatus = (status: number): PublicErrorStatus => {
  if (status === 400 || status === 401 || status === 404 || status === 409 || status === 422) {
    return status;
  }

  return 502;
};

const clearFailedResource = async (
  c: Context<AppEnv>,
  resource: SessionResource
): Promise<void> => {
  const remaining = await deleteSessionResource(c.get('sessionId'), c.get('session'), resource);

  if (!remaining) {
    clearSessionCookie(c);
  }
};

export const requestUpstream = async <Schema extends z.ZodType>(
  c: Context<AppEnv>,
  request: UpstreamRequest<Schema>
): Promise<z.output<Schema>> => {
  const sessionId = c.get('sessionId');
  let session = c.get('session');
  let token = session[request.upstream];

  if (!token) {
    throw new HttpError(401, 'The requested resource is not connected.');
  }

  let response = await fetchUpstream(token, request);

  if (response.status === 401) {
    try {
      session = await refreshSessionResource(sessionId, session, request.upstream);
      token = session[request.upstream];

      if (!token) {
        throw new Error('The refreshed token slot is missing.');
      }

      response = await fetchUpstream(token, request);
    } catch {
      await clearFailedResource(c, request.upstream);
      throw new HttpError(401, 'The requested resource connection expired.');
    }

    if (response.status === 401) {
      await deleteSessionResource(sessionId, session, request.upstream).then(remaining => {
        if (!remaining) {
          clearSessionCookie(c);
        }
      });
      throw new HttpError(401, 'The requested resource connection expired.');
    }
  }

  const { data, isJson } = await readResponseData(response);

  if (!response.ok) {
    const status = publicStatus(response.status);
    const fallback =
      status === 502
        ? 'Upstream service is unavailable.'
        : `Upstream service rejected the request (${response.status}).`;
    throw new HttpError(status, isJson ? getErrorMessage(data, fallback) : fallback);
  }

  if (response.status !== request.expectedStatus || !isJson) {
    throw new HttpError(502, 'Upstream service returned an invalid response.');
  }

  const parsed = request.responseSchema.safeParse(data);

  if (!parsed.success) {
    console.error(
      `Upstream response contract violation: ${request.operation}`,
      parsed.error.issues
    );
    throw new HttpError(502, 'Upstream service returned an invalid response.');
  }

  return parsed.data;
};
