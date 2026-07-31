import { config } from '../config.js';
import { AuthError } from '../types/auth-error.js';
import { AuthTokensSchema, type AuthTokens, type SessionResource } from '../types/session.js';
import { z } from 'zod';
import { runtime } from './runtime.js';

const OAuthTokensSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number().int().positive(),
  token_type: z.string(),
});

const readResponseData = (text: string): unknown => {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const fetchAuth = async (url: string, init: RequestInit): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.upstreamTimeoutMilliseconds);

  try {
    return await runtime.fetch(url, { ...init, signal: controller.signal });
  } catch {
    throw new AuthError(502, { message: 'Authentication service is unavailable.' });
  } finally {
    clearTimeout(timeout);
  }
};

const postJson = async (
  baseUrl: string,
  path: string,
  body: unknown,
  expectedStatus = 200
): Promise<AuthTokens> => {
  const response = await fetchAuth(`${baseUrl.replace(/\/$/, '')}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  const data = readResponseData(text);

  if (!response.ok || response.status !== expectedStatus) {
    throw new AuthError(response.status, data);
  }

  const result = AuthTokensSchema.safeParse(data);

  if (!result.success) {
    throw new AuthError(502, { message: 'Authentication service returned an invalid response.' });
  }

  return result.data;
};

export const login = (request: unknown): Promise<AuthTokens> =>
  postJson(config.authBaseUrl, '/auth/login', request);

export const register = (request: unknown): Promise<AuthTokens> =>
  postJson(config.authBaseUrl, '/auth/register', request);

export const arcadeLogin = (request: unknown): Promise<AuthTokens> =>
  postJson(config.arcadeAuthBaseUrl, '/auth/login', request);

export const arcadeRegister = (request: unknown): Promise<AuthTokens> =>
  postJson(config.arcadeAuthBaseUrl, '/auth/register', request);

const postToken = async (parameters: URLSearchParams): Promise<AuthTokens> => {
  const response = await fetchAuth(`${config.authBaseUrl.replace(/\/$/, '')}/oauth/token`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json',
    },
    body: parameters,
  });

  const text = await response.text();
  const data = readResponseData(text);

  if (!response.ok) {
    throw new AuthError(response.status, data);
  }

  const result = OAuthTokensSchema.safeParse(data);

  if (!result.success) {
    throw new AuthError(502, { message: 'Authentication service returned an invalid response.' });
  }

  return {
    accessToken: result.data.access_token,
    refreshToken: result.data.refresh_token,
    expiresIn: result.data.expires_in,
    tokenType: result.data.token_type,
  };
};

const clientParameters = (): Record<string, string> => ({
  client_id: config.authClientId,
  client_secret: config.authClientSecret,
});

export const exchangeAuthorizationCode = (
  code: string,
  codeVerifier: string
): Promise<AuthTokens> =>
  postToken(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${config.publicBaseUrl}/auth/callback`,
      code_verifier: codeVerifier,
      ...clientParameters(),
    })
  );

const refreshOAuth = (refreshToken: string): Promise<AuthTokens> =>
  postToken(
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      ...clientParameters(),
    })
  );

export const refreshResource = (
  resource: SessionResource,
  refreshToken: string
): Promise<AuthTokens> =>
  resource === 'arcade'
    ? postJson(config.arcadeAuthBaseUrl, '/auth/refresh', { refreshToken })
    : refreshOAuth(refreshToken);

export const revokeArcade = async (refreshToken: string): Promise<void> => {
  const response = await fetchAuth(`${config.arcadeAuthBaseUrl.replace(/\/$/, '')}/auth/revoke`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  });

  if (response.status !== 204) {
    const data = readResponseData(await response.text());
    throw new AuthError(response.status, data);
  }
};
