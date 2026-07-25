import { config } from '../config.js';
import { AuthError } from '../types/auth-error.js';
import { AuthTokensSchema, type AuthTokens } from '../types/session.js';
import { z } from 'zod';

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

const postToken = async (parameters: URLSearchParams): Promise<AuthTokens> => {
  const response = await fetch(`${config.authBaseUrl}/oauth/token`, {
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

export const refresh = (refreshToken: string): Promise<AuthTokens> =>
  postToken(
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      ...clientParameters(),
    })
  );
