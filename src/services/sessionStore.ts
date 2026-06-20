import crypto from 'node:crypto';
import { config } from '../config.js';
import type { AuthTokens, Session } from '../types/session.js';
import { redis } from './redisClient.js';

const keyFor = (sessionId: string): string => `session:${sessionId}`;

export const createSession = async (tokens: AuthTokens): Promise<string> => {
  const sessionId = crypto.randomUUID();
  await saveSession(sessionId, tokens);
  return sessionId;
};

export const getSession = async (sessionId: string): Promise<Session | null> => {
  const value = await redis.get(keyFor(sessionId));

  if (!value || typeof value !== 'string') {
    return null;
  }

  return JSON.parse(value) as Session;
};

export const saveSession = async (sessionId: string, tokens: AuthTokens): Promise<Session> => {
  const session: Session = {
    ...tokens,
    accessTokenExpiresAt: Date.now() + tokens.expiresIn * 1000,
  };

  await redis.setJson(keyFor(sessionId), session, config.sessionTtlSeconds);
  return session;
};

export const deleteSession = (sessionId: string): Promise<string | number | null> =>
  redis.del(keyFor(sessionId));
