import crypto from 'node:crypto';
import { config } from './config.js';
import { redis } from './redisClient.js';

const keyFor = (sessionId) => `session:${sessionId}`;

export const createSession = async (tokens) => {
  const sessionId = crypto.randomUUID();
  await saveSession(sessionId, tokens);
  return sessionId;
};

export const getSession = async (sessionId) => {
  const value = await redis.get(keyFor(sessionId));

  if (!value) {
    return null;
  }

  return JSON.parse(value);
};

export const saveSession = async (sessionId, tokens) => {
  const session = {
    ...tokens,
    accessTokenExpiresAt: Date.now() + tokens.expiresIn * 1000,
  };

  await redis.setJson(keyFor(sessionId), session, config.sessionTtlSeconds);
  return session;
};

export const deleteSession = (sessionId) => redis.del(keyFor(sessionId));
