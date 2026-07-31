import { z } from '@hono/zod-openapi';

export const ArcadeMeResponseSchema = z
  .object({
    sub: z.string(),
    email: z.email().optional(),
    issuer: z.url(),
    audience: z.string(),
  })
  .openapi('ArcadeMeResponse');

export const ArcadeProfileSchema = z
  .object({
    ownerSub: z.string(),
    displayName: z.string().min(1).max(40),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi('ArcadeProfile');

export const ArcadePutProfileRequestSchema = z
  .object({
    displayName: z.string().trim().min(1).max(40),
  })
  .strict()
  .openapi('ArcadePutProfileRequest');

export const ArcadeGameSchema = z
  .object({
    key: z.string(),
    name: z.string(),
    description: z.string(),
    scoreOrder: z.literal('higher-is-better'),
    enabled: z.boolean(),
  })
  .openapi('ArcadeGame');

export const ArcadeGameListSchema = z
  .object({
    items: z.array(ArcadeGameSchema),
  })
  .openapi('ArcadeGameList');

const GameKeySchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const ArcadeGameKeyParamsSchema = z.object({
  gameKey: GameKeySchema,
});

export const ArcadeScoreIdParamsSchema = z.object({
  scoreId: z.string().uuid(),
});

const MetadataSchema = z.record(z.string(), z.unknown()).superRefine((metadata, context) => {
  if (Buffer.byteLength(JSON.stringify(metadata), 'utf8') > 4_096) {
    context.addIssue({
      code: 'custom',
      message: 'metadata must be at most 4096 bytes when encoded as JSON',
    });
  }
});

export const ArcadeCreateScoreRequestSchema = z
  .object({
    gameKey: GameKeySchema,
    score: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    playedAt: z.string().datetime({ offset: true }).optional(),
    metadata: MetadataSchema.default({}),
  })
  .strict()
  .openapi('ArcadeCreateScoreRequest');

export const ArcadeScoreSchema = z
  .object({
    id: z.string().uuid(),
    gameKey: z.string(),
    score: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    playedAt: z.string().datetime(),
    metadata: z.record(z.string(), z.unknown()),
    createdAt: z.string().datetime(),
  })
  .openapi('ArcadeScore');

export const ArcadeScoreListQuerySchema = z.object({
  gameKey: GameKeySchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const ArcadeScoreListSchema = z
  .object({
    items: z.array(ArcadeScoreSchema),
  })
  .openapi('ArcadeScoreList');

export const ArcadeLeaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const ArcadeLeaderboardEntrySchema = z
  .object({
    rank: z.number().int().positive(),
    displayName: z.string().min(1).max(40),
    score: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    achievedAt: z.string().datetime(),
  })
  .openapi('ArcadeLeaderboardEntry');

export const ArcadeLeaderboardSchema = z
  .object({
    gameKey: z.string(),
    scoreOrder: z.literal('higher-is-better'),
    ranking: z.literal(
      'RANK by score; equal scores share a rank and earlier achievedAt is listed first.'
    ),
    entries: z.array(ArcadeLeaderboardEntrySchema),
  })
  .openapi('ArcadeLeaderboard');
