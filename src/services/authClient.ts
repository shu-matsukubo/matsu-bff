import { config } from '../config.js';
import { AuthError } from '../types/auth-error.js';
import { AuthTokensSchema, type AuthTokens } from '../types/session.js';

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

const postAuth = async (path: string, body: unknown): Promise<AuthTokens> => {
  const response = await fetch(`${config.authBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  const data = readResponseData(text);

  if (!response.ok) {
    throw new AuthError(response.status, data);
  }

  const result = AuthTokensSchema.safeParse(data);

  if (!result.success) {
    throw new AuthError(502, { message: 'Authentication service returned an invalid response.' });
  }

  return result.data;
};

export const login = (request: unknown): Promise<AuthTokens> => postAuth('/auth/login', request);

export const register = (request: unknown): Promise<AuthTokens> =>
  postAuth('/auth/register', request);

export const refresh = (refreshToken: string): Promise<AuthTokens> =>
  postAuth('/auth/refresh', {
    refreshToken,
  });
