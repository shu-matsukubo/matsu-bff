import { z } from '@hono/zod-openapi';

export const AuthRequestSchema = z
  .object({
    email: z.email().openapi({ example: 'user@example.com' }),
    password: z.string().min(8).openapi({ example: 'password' }),
  })
  .openapi('AuthRequest');

export const AuthenticatedResponseSchema = z
  .object({
    authenticated: z.literal(true),
  })
  .openapi('AuthenticatedResponse');

export const LoggedOutResponseSchema = z
  .object({
    authenticated: z.literal(false),
  })
  .openapi('LoggedOutResponse');
