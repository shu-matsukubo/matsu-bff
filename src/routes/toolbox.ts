import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi';
import { requireSession } from '../middleware/session.js';
import { badRequestResponse, errorResponse } from '../schemas/common.js';
import {
  ToolboxBookmarkIdParamsSchema,
  ToolboxBookmarkListQuerySchema,
  ToolboxBookmarkListSchema,
  ToolboxBookmarkSchema,
  ToolboxCreateBookmarkSchema,
  ToolboxCreateNoteSchema,
  ToolboxInspectTextSchema,
  ToolboxMeResponseSchema,
  ToolboxNoteIdParamsSchema,
  ToolboxNoteListSchema,
  ToolboxNoteSchema,
  ToolboxTextInspectionSchema,
  ToolboxUpdateBookmarkSchema,
  ToolboxUpdateNoteSchema,
} from '../schemas/toolbox.js';
import { requestUpstream } from '../services/upstreamClient.js';
import type { AppEnv } from '../types/app.js';

const protectedRoute = {
  security: [{ SessionCookie: [] }],
  middleware: [requireSession],
};

const upstreamErrors = {
  400: badRequestResponse,
  401: errorResponse('The Toolbox connection is missing or expired.'),
  404: errorResponse('The requested Toolbox resource was not found.'),
  409: errorResponse('The Toolbox request conflicts with existing state.'),
  422: errorResponse('The Toolbox request was rejected.'),
  502: errorResponse('Toolbox is unavailable or violated the BFF response contract.'),
};

const toolboxMeRoute = createRoute({
  method: 'get',
  path: '/api/toolbox/me',
  tags: ['Toolbox'],
  summary: 'Get the connected Toolbox identity',
  ...protectedRoute,
  responses: {
    200: {
      description: 'Verified Toolbox identity.',
      content: { 'application/json': { schema: ToolboxMeResponseSchema } },
    },
    ...upstreamErrors,
  },
});

const createNoteRoute = createRoute({
  method: 'post',
  path: '/api/toolbox/notes',
  tags: ['Toolbox'],
  summary: 'Create a Toolbox note',
  ...protectedRoute,
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: ToolboxCreateNoteSchema } },
    },
  },
  responses: {
    201: {
      description: 'Created note.',
      content: { 'application/json': { schema: ToolboxNoteSchema } },
    },
    ...upstreamErrors,
  },
});

const listNotesRoute = createRoute({
  method: 'get',
  path: '/api/toolbox/notes',
  tags: ['Toolbox'],
  summary: 'List Toolbox notes',
  ...protectedRoute,
  responses: {
    200: {
      description: 'Owned Toolbox notes.',
      content: { 'application/json': { schema: ToolboxNoteListSchema } },
    },
    ...upstreamErrors,
  },
});

const getNoteRoute = createRoute({
  method: 'get',
  path: '/api/toolbox/notes/{noteId}',
  tags: ['Toolbox'],
  summary: 'Get a Toolbox note',
  ...protectedRoute,
  request: { params: ToolboxNoteIdParamsSchema },
  responses: {
    200: {
      description: 'Owned Toolbox note.',
      content: { 'application/json': { schema: ToolboxNoteSchema } },
    },
    ...upstreamErrors,
  },
});

const updateNoteRoute = createRoute({
  method: 'patch',
  path: '/api/toolbox/notes/{noteId}',
  tags: ['Toolbox'],
  summary: 'Update a Toolbox note',
  ...protectedRoute,
  request: {
    params: ToolboxNoteIdParamsSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: ToolboxUpdateNoteSchema } },
    },
  },
  responses: {
    200: {
      description: 'Updated Toolbox note.',
      content: { 'application/json': { schema: ToolboxNoteSchema } },
    },
    ...upstreamErrors,
  },
});

const deleteNoteRoute = createRoute({
  method: 'delete',
  path: '/api/toolbox/notes/{noteId}',
  tags: ['Toolbox'],
  summary: 'Delete a Toolbox note',
  ...protectedRoute,
  request: { params: ToolboxNoteIdParamsSchema },
  responses: {
    204: { description: 'Deleted Toolbox note.' },
    ...upstreamErrors,
  },
});

const createBookmarkRoute = createRoute({
  method: 'post',
  path: '/api/toolbox/bookmarks',
  tags: ['Toolbox'],
  summary: 'Create a Toolbox bookmark',
  ...protectedRoute,
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: ToolboxCreateBookmarkSchema } },
    },
  },
  responses: {
    201: {
      description: 'Created bookmark.',
      content: { 'application/json': { schema: ToolboxBookmarkSchema } },
    },
    ...upstreamErrors,
  },
});

const listBookmarksRoute = createRoute({
  method: 'get',
  path: '/api/toolbox/bookmarks',
  tags: ['Toolbox'],
  summary: 'List Toolbox bookmarks',
  ...protectedRoute,
  request: { query: ToolboxBookmarkListQuerySchema },
  responses: {
    200: {
      description: 'Owned Toolbox bookmarks.',
      content: { 'application/json': { schema: ToolboxBookmarkListSchema } },
    },
    ...upstreamErrors,
  },
});

const getBookmarkRoute = createRoute({
  method: 'get',
  path: '/api/toolbox/bookmarks/{bookmarkId}',
  tags: ['Toolbox'],
  summary: 'Get a Toolbox bookmark',
  ...protectedRoute,
  request: { params: ToolboxBookmarkIdParamsSchema },
  responses: {
    200: {
      description: 'Owned Toolbox bookmark.',
      content: { 'application/json': { schema: ToolboxBookmarkSchema } },
    },
    ...upstreamErrors,
  },
});

const updateBookmarkRoute = createRoute({
  method: 'patch',
  path: '/api/toolbox/bookmarks/{bookmarkId}',
  tags: ['Toolbox'],
  summary: 'Update a Toolbox bookmark',
  ...protectedRoute,
  request: {
    params: ToolboxBookmarkIdParamsSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: ToolboxUpdateBookmarkSchema } },
    },
  },
  responses: {
    200: {
      description: 'Updated Toolbox bookmark.',
      content: { 'application/json': { schema: ToolboxBookmarkSchema } },
    },
    ...upstreamErrors,
  },
});

const deleteBookmarkRoute = createRoute({
  method: 'delete',
  path: '/api/toolbox/bookmarks/{bookmarkId}',
  tags: ['Toolbox'],
  summary: 'Delete a Toolbox bookmark',
  ...protectedRoute,
  request: { params: ToolboxBookmarkIdParamsSchema },
  responses: {
    204: { description: 'Deleted Toolbox bookmark.' },
    ...upstreamErrors,
  },
});

const inspectTextRoute = createRoute({
  method: 'post',
  path: '/api/toolbox/tools/text/inspect',
  tags: ['Toolbox'],
  summary: 'Inspect text with Toolbox',
  ...protectedRoute,
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: ToolboxInspectTextSchema } },
    },
  },
  responses: {
    200: {
      description: 'Text inspection metrics.',
      content: { 'application/json': { schema: ToolboxTextInspectionSchema } },
    },
    ...upstreamErrors,
  },
});

export const registerToolboxRoutes = (app: OpenAPIHono<AppEnv>): void => {
  app.openapi(toolboxMeRoute, async c => {
    const data = await requestUpstream(c, {
      upstream: 'toolbox',
      path: '/me',
      expectedStatus: 200,
      responseSchema: ToolboxMeResponseSchema,
      operation: 'Toolbox identity',
    });
    return c.json(data, 200);
  });

  app.openapi(createNoteRoute, async c => {
    const data = await requestUpstream(c, {
      upstream: 'toolbox',
      path: '/notes',
      method: 'POST',
      body: c.req.valid('json'),
      expectedStatus: 201,
      responseSchema: ToolboxNoteSchema,
      operation: 'create Toolbox note',
    });
    return c.json(data, 201);
  });

  app.openapi(listNotesRoute, async c => {
    const data = await requestUpstream(c, {
      upstream: 'toolbox',
      path: '/notes',
      expectedStatus: 200,
      responseSchema: ToolboxNoteListSchema,
      operation: 'list Toolbox notes',
    });
    return c.json(data, 200);
  });

  app.openapi(getNoteRoute, async c => {
    const { noteId } = c.req.valid('param');
    const data = await requestUpstream(c, {
      upstream: 'toolbox',
      path: `/notes/${encodeURIComponent(noteId)}`,
      expectedStatus: 200,
      responseSchema: ToolboxNoteSchema,
      operation: 'get Toolbox note',
    });
    return c.json(data, 200);
  });

  app.openapi(updateNoteRoute, async c => {
    const { noteId } = c.req.valid('param');
    const data = await requestUpstream(c, {
      upstream: 'toolbox',
      path: `/notes/${encodeURIComponent(noteId)}`,
      method: 'PATCH',
      body: c.req.valid('json'),
      expectedStatus: 200,
      responseSchema: ToolboxNoteSchema,
      operation: 'update Toolbox note',
    });
    return c.json(data, 200);
  });

  app.openapi(deleteNoteRoute, async c => {
    const { noteId } = c.req.valid('param');
    await requestUpstream(c, {
      upstream: 'toolbox',
      path: `/notes/${encodeURIComponent(noteId)}`,
      method: 'DELETE',
      expectedStatus: 204,
      responseSchema: z.null(),
      operation: 'delete Toolbox note',
    });
    return c.body(null, 204);
  });

  app.openapi(createBookmarkRoute, async c => {
    const data = await requestUpstream(c, {
      upstream: 'toolbox',
      path: '/bookmarks',
      method: 'POST',
      body: c.req.valid('json'),
      expectedStatus: 201,
      responseSchema: ToolboxBookmarkSchema,
      operation: 'create Toolbox bookmark',
    });
    return c.json(data, 201);
  });

  app.openapi(listBookmarksRoute, async c => {
    const query = c.req.valid('query');
    const data = await requestUpstream(c, {
      upstream: 'toolbox',
      path: '/bookmarks',
      query: { tag: query.tag },
      expectedStatus: 200,
      responseSchema: ToolboxBookmarkListSchema,
      operation: 'list Toolbox bookmarks',
    });
    return c.json(data, 200);
  });

  app.openapi(getBookmarkRoute, async c => {
    const { bookmarkId } = c.req.valid('param');
    const data = await requestUpstream(c, {
      upstream: 'toolbox',
      path: `/bookmarks/${encodeURIComponent(bookmarkId)}`,
      expectedStatus: 200,
      responseSchema: ToolboxBookmarkSchema,
      operation: 'get Toolbox bookmark',
    });
    return c.json(data, 200);
  });

  app.openapi(updateBookmarkRoute, async c => {
    const { bookmarkId } = c.req.valid('param');
    const data = await requestUpstream(c, {
      upstream: 'toolbox',
      path: `/bookmarks/${encodeURIComponent(bookmarkId)}`,
      method: 'PATCH',
      body: c.req.valid('json'),
      expectedStatus: 200,
      responseSchema: ToolboxBookmarkSchema,
      operation: 'update Toolbox bookmark',
    });
    return c.json(data, 200);
  });

  app.openapi(deleteBookmarkRoute, async c => {
    const { bookmarkId } = c.req.valid('param');
    await requestUpstream(c, {
      upstream: 'toolbox',
      path: `/bookmarks/${encodeURIComponent(bookmarkId)}`,
      method: 'DELETE',
      expectedStatus: 204,
      responseSchema: z.null(),
      operation: 'delete Toolbox bookmark',
    });
    return c.body(null, 204);
  });

  app.openapi(inspectTextRoute, async c => {
    const data = await requestUpstream(c, {
      upstream: 'toolbox',
      path: '/tools/text/inspect',
      method: 'POST',
      body: c.req.valid('json'),
      expectedStatus: 200,
      responseSchema: ToolboxTextInspectionSchema,
      operation: 'inspect Toolbox text',
    });
    return c.json(data, 200);
  });
};
