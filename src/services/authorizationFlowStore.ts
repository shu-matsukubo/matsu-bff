import crypto from 'node:crypto';
import { z } from 'zod';
import { config } from '../config.js';
import { redis } from './redisClient.js';

const OAuthResourceSchema = z.enum(['matsuApi', 'toolbox']);
export type OAuthResource = z.infer<typeof OAuthResourceSchema>;

const AuthorizationFlowSchema = z
  .object({
    codeVerifier: z.string().min(1),
    resource: OAuthResourceSchema,
  })
  .strict();

type AuthorizationFlow = z.infer<typeof AuthorizationFlowSchema>;

export interface StartedAuthorizationFlow {
  authorizationUrl: string;
  state: string;
}

const keyFor = (state: string): string => `authorization-flow:${state}`;

const randomBase64Url = (bytes: number): string => crypto.randomBytes(bytes).toString('base64url');

export const startAuthorizationFlow = async (
  resource: OAuthResource = 'matsuApi'
): Promise<StartedAuthorizationFlow> => {
  const state = randomBase64Url(32);
  const codeVerifier = randomBase64Url(64);
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  const flow: AuthorizationFlow = { codeVerifier, resource };

  await redis.setJson(keyFor(state), flow, config.authorizationFlowTtlSeconds);

  const authorizationUrl = new URL('/oauth/authorize', config.authPublicBaseUrl);
  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('client_id', config.authClientId);
  authorizationUrl.searchParams.set('redirect_uri', `${config.publicBaseUrl}/auth/callback`);
  authorizationUrl.searchParams.set(
    'scope',
    resource === 'toolbox' ? 'matsu-toolbox-api' : config.authScope
  );
  authorizationUrl.searchParams.set('state', state);
  authorizationUrl.searchParams.set('code_challenge', codeChallenge);
  authorizationUrl.searchParams.set('code_challenge_method', 'S256');

  return {
    authorizationUrl: authorizationUrl.toString(),
    state,
  };
};

export const consumeAuthorizationFlow = async (
  state: string
): Promise<AuthorizationFlow | null> => {
  const value = await redis.getDel(keyFor(state));

  if (!value || typeof value !== 'string') {
    return null;
  }

  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(value) as unknown;
  } catch {
    return null;
  }

  const parsed = AuthorizationFlowSchema.safeParse(parsedJson);
  return parsed.success ? parsed.data : null;
};
