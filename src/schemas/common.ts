import { z } from '@hono/zod-openapi';

export const ErrorResponseSchema = z
  .object({
    message: z.string(),
  })
  .openapi('ErrorResponse');

export const ValidationIssueSchema = z
  .object({
    path: z.string(),
    message: z.string(),
  })
  .openapi('ValidationIssue');

export const ValidationErrorResponseSchema = z
  .object({
    message: z.string(),
    issues: z.array(ValidationIssueSchema),
  })
  .openapi('ValidationErrorResponse');

export const BadRequestResponseSchema = z
  .union([ValidationErrorResponseSchema, ErrorResponseSchema])
  .openapi('BadRequestResponse');

export const errorResponse = (description: string) => ({
  description,
  content: {
    'application/json': {
      schema: ErrorResponseSchema,
    },
  },
});

export const validationErrorResponse = {
  description: 'Request validation failed.',
  content: {
    'application/json': {
      schema: ValidationErrorResponseSchema,
    },
  },
};

export const badRequestResponse = {
  description: 'The request is invalid.',
  content: {
    'application/json': {
      schema: BadRequestResponseSchema,
    },
  },
};
