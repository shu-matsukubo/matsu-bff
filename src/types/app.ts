import type { SessionVariables } from '../middleware/session.js';

export interface AppEnv {
  Variables: SessionVariables;
}
