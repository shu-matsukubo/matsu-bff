import { config } from '../config.js';
import { AuthError } from '../types/auth-error.js';
import type { AuthTokens } from '../types/session.js';

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
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new AuthError(response.status, data);
  }

  return data as AuthTokens;
};

export const login = (request: unknown): Promise<AuthTokens> => postAuth('/auth/login', request);

export const register = (request: unknown): Promise<AuthTokens> => postAuth('/auth/register', request);

export const refresh = (refreshToken: string): Promise<AuthTokens> =>
  postAuth('/auth/refresh', {
    refreshToken,
  });
