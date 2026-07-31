import crypto from 'node:crypto';
import { config } from '../config.js';
import {
  createEmptySession,
  createResourceToken,
  hasSessionResources,
  parseStoredSession,
  SessionSchema,
  type AuthTokens,
  type Session,
  type SessionResource,
} from '../types/session.js';
import { redis } from './redisClient.js';
import { runtime } from './runtime.js';

const keyFor = (sessionId: string): string => `session:${sessionId}`;

export const createSession = async (
  tokens: AuthTokens,
  resource: SessionResource = 'matsuApi'
): Promise<string> => {
  const sessionId = crypto.randomUUID();
  await saveSessionResource(sessionId, createEmptySession(), resource, tokens);
  return sessionId;
};

export const getSession = async (sessionId: string): Promise<Session | null> => {
  const value = await redis.get(keyFor(sessionId));

  if (!value || typeof value !== 'string') {
    return null;
  }

  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(value) as unknown;
  } catch {
    await deleteSession(sessionId);
    return null;
  }

  const parsed = parseStoredSession(parsedJson);

  if (!parsed) {
    await deleteSession(sessionId);
    return null;
  }

  if (parsed.migrated) {
    await saveSession(sessionId, parsed.session);
  }

  return parsed.session;
};

export const saveSession = async (sessionId: string, session: Session): Promise<Session> => {
  const validated = SessionSchema.parse(session);
  await redis.setJson(keyFor(sessionId), validated, config.sessionTtlSeconds);
  return validated;
};

export const deleteSession = (sessionId: string): Promise<string | number | null> =>
  redis.del(keyFor(sessionId));

export const saveSessionResource = (
  sessionId: string,
  session: Session,
  resource: SessionResource,
  tokens: AuthTokens
): Promise<Session> =>
  saveSession(sessionId, {
    ...session,
    [resource]: createResourceToken(tokens, runtime.now()),
  });

export const deleteSessionResource = async (
  sessionId: string,
  session: Session,
  resource: SessionResource
): Promise<Session | null> => {
  const updated = { ...session };
  delete updated[resource];

  if (!hasSessionResources(updated)) {
    await deleteSession(sessionId);
    return null;
  }

  return saveSession(sessionId, updated);
};
