import { z } from 'zod';

export const AuthTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int().positive(),
  tokenType: z.string().optional(),
});

export type AuthTokens = z.infer<typeof AuthTokensSchema>;

export type Session = AuthTokens & {
  accessTokenExpiresAt: number;
};
