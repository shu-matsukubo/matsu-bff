import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi';
import { requireSession } from '../middleware/session.js';
import {
  ArcadeCreateScoreRequestSchema,
  ArcadeGameKeyParamsSchema,
  ArcadeGameListSchema,
  ArcadeGameSchema,
  ArcadeLeaderboardQuerySchema,
  ArcadeLeaderboardSchema,
  ArcadeMeResponseSchema,
  ArcadeProfileSchema,
  ArcadePutProfileRequestSchema,
  ArcadeScoreIdParamsSchema,
  ArcadeScoreListQuerySchema,
  ArcadeScoreListSchema,
  ArcadeScoreSchema,
} from '../schemas/arcade.js';
import { badRequestResponse, errorResponse } from '../schemas/common.js';
import { requestUpstream } from '../services/upstreamClient.js';
import type { AppEnv } from '../types/app.js';

const protectedRoute = {
  security: [{ SessionCookie: [] }],
  middleware: [requireSession],
};

const upstreamErrors = {
  400: badRequestResponse,
  401: errorResponse('The Arcade connection is missing or expired.'),
  404: errorResponse('The requested Arcade resource was not found.'),
  409: errorResponse('The Arcade request conflicts with existing state.'),
  422: errorResponse('The Arcade request was rejected.'),
  502: errorResponse('Arcade is unavailable or violated the BFF response contract.'),
};

const meRoute = createRoute({
  method: 'get',
  path: '/api/arcade/me',
  tags: ['Arcade'],
  summary: 'Get the connected Arcade identity',
  ...protectedRoute,
  responses: {
    200: {
      description: 'Verified Arcade identity.',
      content: { 'application/json': { schema: ArcadeMeResponseSchema } },
    },
    ...upstreamErrors,
  },
});

const getProfileRoute = createRoute({
  method: 'get',
  path: '/api/arcade/profile',
  tags: ['Arcade'],
  summary: 'Get the Arcade player profile',
  ...protectedRoute,
  responses: {
    200: {
      description: 'Arcade player profile.',
      content: { 'application/json': { schema: ArcadeProfileSchema } },
    },
    ...upstreamErrors,
  },
});

const putProfileRoute = createRoute({
  method: 'put',
  path: '/api/arcade/profile',
  tags: ['Arcade'],
  summary: 'Create or replace the Arcade player profile',
  ...protectedRoute,
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: ArcadePutProfileRequestSchema } },
    },
  },
  responses: {
    200: {
      description: 'Created or replaced Arcade player profile.',
      content: { 'application/json': { schema: ArcadeProfileSchema } },
    },
    ...upstreamErrors,
  },
});

const listGamesRoute = createRoute({
  method: 'get',
  path: '/api/arcade/games',
  tags: ['Arcade'],
  summary: 'List enabled Arcade games',
  ...protectedRoute,
  responses: {
    200: {
      description: 'Enabled Arcade games.',
      content: { 'application/json': { schema: ArcadeGameListSchema } },
    },
    ...upstreamErrors,
  },
});

const getGameRoute = createRoute({
  method: 'get',
  path: '/api/arcade/games/{gameKey}',
  tags: ['Arcade'],
  summary: 'Get an Arcade game',
  ...protectedRoute,
  request: { params: ArcadeGameKeyParamsSchema },
  responses: {
    200: {
      description: 'Enabled Arcade game.',
      content: { 'application/json': { schema: ArcadeGameSchema } },
    },
    ...upstreamErrors,
  },
});

const createScoreRoute = createRoute({
  method: 'post',
  path: '/api/arcade/scores',
  tags: ['Arcade'],
  summary: 'Record an Arcade score',
  ...protectedRoute,
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: ArcadeCreateScoreRequestSchema } },
    },
  },
  responses: {
    201: {
      description: 'Recorded Arcade score.',
      content: { 'application/json': { schema: ArcadeScoreSchema } },
    },
    ...upstreamErrors,
  },
});

const listScoresRoute = createRoute({
  method: 'get',
  path: '/api/arcade/scores',
  tags: ['Arcade'],
  summary: 'List the connected player Arcade scores',
  ...protectedRoute,
  request: { query: ArcadeScoreListQuerySchema },
  responses: {
    200: {
      description: 'Arcade scores.',
      content: { 'application/json': { schema: ArcadeScoreListSchema } },
    },
    ...upstreamErrors,
  },
});

const getScoreRoute = createRoute({
  method: 'get',
  path: '/api/arcade/scores/{scoreId}',
  tags: ['Arcade'],
  summary: 'Get an Arcade score',
  ...protectedRoute,
  request: { params: ArcadeScoreIdParamsSchema },
  responses: {
    200: {
      description: 'Owned Arcade score.',
      content: { 'application/json': { schema: ArcadeScoreSchema } },
    },
    ...upstreamErrors,
  },
});

const deleteScoreRoute = createRoute({
  method: 'delete',
  path: '/api/arcade/scores/{scoreId}',
  tags: ['Arcade'],
  summary: 'Delete an Arcade score',
  ...protectedRoute,
  request: { params: ArcadeScoreIdParamsSchema },
  responses: {
    204: { description: 'Deleted Arcade score.' },
    ...upstreamErrors,
  },
});

const leaderboardRoute = createRoute({
  method: 'get',
  path: '/api/arcade/leaderboards/{gameKey}',
  tags: ['Arcade'],
  summary: 'Get an Arcade leaderboard',
  ...protectedRoute,
  request: {
    params: ArcadeGameKeyParamsSchema,
    query: ArcadeLeaderboardQuerySchema,
  },
  responses: {
    200: {
      description: 'Arcade leaderboard.',
      content: { 'application/json': { schema: ArcadeLeaderboardSchema } },
    },
    ...upstreamErrors,
  },
});

export const registerArcadeRoutes = (app: OpenAPIHono<AppEnv>): void => {
  app.openapi(meRoute, async c => {
    const data = await requestUpstream(c, {
      upstream: 'arcade',
      path: '/me',
      expectedStatus: 200,
      responseSchema: ArcadeMeResponseSchema,
      operation: 'Arcade identity',
    });
    return c.json(data, 200);
  });

  app.openapi(getProfileRoute, async c => {
    const data = await requestUpstream(c, {
      upstream: 'arcade',
      path: '/profile',
      expectedStatus: 200,
      responseSchema: ArcadeProfileSchema,
      operation: 'get Arcade profile',
    });
    return c.json(data, 200);
  });

  app.openapi(putProfileRoute, async c => {
    const data = await requestUpstream(c, {
      upstream: 'arcade',
      path: '/profile',
      method: 'PUT',
      body: c.req.valid('json'),
      expectedStatus: 200,
      responseSchema: ArcadeProfileSchema,
      operation: 'put Arcade profile',
    });
    return c.json(data, 200);
  });

  app.openapi(listGamesRoute, async c => {
    const data = await requestUpstream(c, {
      upstream: 'arcade',
      path: '/games',
      expectedStatus: 200,
      responseSchema: ArcadeGameListSchema,
      operation: 'list Arcade games',
    });
    return c.json(data, 200);
  });

  app.openapi(getGameRoute, async c => {
    const { gameKey } = c.req.valid('param');
    const data = await requestUpstream(c, {
      upstream: 'arcade',
      path: `/games/${encodeURIComponent(gameKey)}`,
      expectedStatus: 200,
      responseSchema: ArcadeGameSchema,
      operation: 'get Arcade game',
    });
    return c.json(data, 200);
  });

  app.openapi(createScoreRoute, async c => {
    const data = await requestUpstream(c, {
      upstream: 'arcade',
      path: '/scores',
      method: 'POST',
      body: c.req.valid('json'),
      expectedStatus: 201,
      responseSchema: ArcadeScoreSchema,
      operation: 'create Arcade score',
    });
    return c.json(data, 201);
  });

  app.openapi(listScoresRoute, async c => {
    const query = c.req.valid('query');
    const data = await requestUpstream(c, {
      upstream: 'arcade',
      path: '/scores',
      query: { gameKey: query.gameKey, limit: query.limit },
      expectedStatus: 200,
      responseSchema: ArcadeScoreListSchema,
      operation: 'list Arcade scores',
    });
    return c.json(data, 200);
  });

  app.openapi(getScoreRoute, async c => {
    const { scoreId } = c.req.valid('param');
    const data = await requestUpstream(c, {
      upstream: 'arcade',
      path: `/scores/${encodeURIComponent(scoreId)}`,
      expectedStatus: 200,
      responseSchema: ArcadeScoreSchema,
      operation: 'get Arcade score',
    });
    return c.json(data, 200);
  });

  app.openapi(deleteScoreRoute, async c => {
    const { scoreId } = c.req.valid('param');
    await requestUpstream(c, {
      upstream: 'arcade',
      path: `/scores/${encodeURIComponent(scoreId)}`,
      method: 'DELETE',
      expectedStatus: 204,
      responseSchema: z.null(),
      operation: 'delete Arcade score',
    });
    return c.body(null, 204);
  });

  app.openapi(leaderboardRoute, async c => {
    const { gameKey } = c.req.valid('param');
    const query = c.req.valid('query');
    const data = await requestUpstream(c, {
      upstream: 'arcade',
      path: `/leaderboards/${encodeURIComponent(gameKey)}`,
      query: { limit: query.limit },
      expectedStatus: 200,
      responseSchema: ArcadeLeaderboardSchema,
      operation: 'get Arcade leaderboard',
    });
    return c.json(data, 200);
  });
};
