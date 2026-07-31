import * as authClient from './authClient.js';
import { saveSessionResource } from './sessionStore.js';
import type { Session, SessionResource } from '../types/session.js';

export const refreshSessionResource = async (
  sessionId: string,
  session: Session,
  resource: SessionResource
): Promise<Session> => {
  const slot = session[resource];

  if (!slot) {
    throw new Error(`Session resource is not connected: ${resource}`);
  }

  const tokens = await authClient.refreshResource(resource, slot.refreshToken);
  return saveSessionResource(sessionId, session, resource, tokens);
};
