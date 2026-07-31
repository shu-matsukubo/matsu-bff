import { z } from '@hono/zod-openapi';

export const AuthRequestSchema = z
  .object({
    email: z.email().openapi({ example: 'user@example.com' }),
    password: z.string().min(8).openapi({ example: 'password' }),
  })
  .openapi('AuthRequest');

export const ResourceConnectionsSchema = z
  .object({
    matsuApi: z.boolean(),
    toolbox: z.boolean(),
    arcade: z.boolean(),
  })
  .openapi('ResourceConnections');

export const AuthenticatedResponseSchema = z
  .object({
    authenticated: z.literal(true),
    resources: ResourceConnectionsSchema,
  })
  .openapi('AuthenticatedResponse');

export const SessionStateResponseSchema = z
  .object({
    authenticated: z.boolean(),
    resources: ResourceConnectionsSchema,
  })
  .openapi('SessionStateResponse');

export const LoggedOutResponseSchema = z
  .object({
    authenticated: z.literal(false),
    resources: z.object({
      matsuApi: z.literal(false),
      toolbox: z.literal(false),
      arcade: z.literal(false),
    }),
  })
  .openapi('LoggedOutResponse');
