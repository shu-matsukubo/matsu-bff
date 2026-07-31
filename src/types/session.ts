import { z } from 'zod';

export const AuthTokensSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresIn: z.number().int().positive(),
  tokenType: z.string().min(1).optional(),
});

export type AuthTokens = z.infer<typeof AuthTokensSchema>;

export const SessionResourceSchema = z.enum(['matsuApi', 'toolbox', 'arcade']);
export type SessionResource = z.infer<typeof SessionResourceSchema>;

export const ResourceTokenSchema = z
  .object({
    accessToken: z.string().min(1),
    refreshToken: z.string().min(1),
    expiresAt: z.number().int().nonnegative(),
    tokenType: z.string().min(1).optional(),
  })
  .strict();

export type ResourceToken = z.infer<typeof ResourceTokenSchema>;

export const SessionSchema = z
  .object({
    version: z.literal(2),
    matsuApi: ResourceTokenSchema.optional(),
    toolbox: ResourceTokenSchema.optional(),
    arcade: ResourceTokenSchema.optional(),
  })
  .strict();

export type Session = z.infer<typeof SessionSchema>;

const LegacySessionSchema = AuthTokensSchema.extend({
  accessTokenExpiresAt: z.number().int().nonnegative(),
});

export const createResourceToken = (tokens: AuthTokens, now: number): ResourceToken => ({
  accessToken: tokens.accessToken,
  refreshToken: tokens.refreshToken,
  expiresAt: now + tokens.expiresIn * 1000,
  ...(tokens.tokenType === undefined ? {} : { tokenType: tokens.tokenType }),
});

export const createEmptySession = (): Session => ({ version: 2 });

export const hasSessionResources = (session: Session): boolean =>
  SessionResourceSchema.options.some(resource => session[resource] !== undefined);

export const parseStoredSession = (
  value: unknown
): { session: Session; migrated: boolean } | null => {
  const current = SessionSchema.safeParse(value);

  if (current.success && hasSessionResources(current.data)) {
    return { session: current.data, migrated: false };
  }

  const legacy = LegacySessionSchema.safeParse(value);

  if (!legacy.success) {
    return null;
  }

  return {
    migrated: true,
    session: {
      version: 2,
      matsuApi: {
        accessToken: legacy.data.accessToken,
        refreshToken: legacy.data.refreshToken,
        expiresAt: legacy.data.accessTokenExpiresAt,
        ...(legacy.data.tokenType === undefined ? {} : { tokenType: legacy.data.tokenType }),
      },
    },
  };
};
