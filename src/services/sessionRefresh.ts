import * as authClient from './authClient.js';
import { saveSession } from './sessionStore.js';
import type { Session } from '../types/session.js';

export const refreshSession = async (sessionId: string, session: Session): Promise<Session> => {
  const tokens = await authClient.refresh(session.refreshToken);
  return saveSession(sessionId, tokens);
};
