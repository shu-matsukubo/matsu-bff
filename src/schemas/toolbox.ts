import { z } from '@hono/zod-openapi';

const TimestampSchema = z.string().datetime({ offset: true });
const ResourceIdSchema = z.string().uuid();

export const ToolboxMeResponseSchema = z
  .object({
    sub: z.string().min(1),
    email: z.email().optional(),
    issuer: z.url(),
    audience: z.string().min(1),
  })
  .openapi('ToolboxMeResponse');

export const ToolboxNoteSchema = z
  .object({
    id: ResourceIdSchema,
    ownerSub: z.string().min(1),
    title: z.string().min(1).max(120),
    content: z.string().max(20_000),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  })
  .openapi('ToolboxNote');

export const ToolboxNoteListSchema = z.array(ToolboxNoteSchema).openapi('ToolboxNoteList');

export const ToolboxCreateNoteSchema = z
  .object({
    title: z.string().min(1).max(120),
    content: z.string().max(20_000).default(''),
  })
  .openapi('ToolboxCreateNote');

export const ToolboxUpdateNoteSchema = z
  .object({
    title: z.string().min(1).max(120).optional(),
    content: z.string().max(20_000).optional(),
  })
  .refine(value => value.title !== undefined || value.content !== undefined, {
    message: 'At least one field must be provided.',
  })
  .openapi('ToolboxUpdateNote');

export const ToolboxNoteIdParamsSchema = z.object({
  noteId: ResourceIdSchema,
});

const HttpUrlSchema = z
  .url()
  .refine(value => ['http:', 'https:'].includes(new URL(value).protocol), {
    message: 'URL must use http or https.',
  });

const TagsSchema = z.array(z.string().trim().min(1).max(50)).max(20);

export const ToolboxBookmarkSchema = z
  .object({
    id: ResourceIdSchema,
    ownerSub: z.string().min(1),
    url: HttpUrlSchema,
    title: z.string().min(1).max(200),
    tags: TagsSchema,
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  })
  .openapi('ToolboxBookmark');

export const ToolboxBookmarkListSchema = z
  .array(ToolboxBookmarkSchema)
  .openapi('ToolboxBookmarkList');

export const ToolboxCreateBookmarkSchema = z
  .object({
    url: HttpUrlSchema,
    title: z.string().min(1).max(200),
    tags: TagsSchema.default([]),
  })
  .openapi('ToolboxCreateBookmark');

export const ToolboxUpdateBookmarkSchema = z
  .object({
    url: HttpUrlSchema.optional(),
    title: z.string().min(1).max(200).optional(),
    tags: TagsSchema.optional(),
  })
  .refine(
    value => value.url !== undefined || value.title !== undefined || value.tags !== undefined,
    { message: 'At least one field must be provided.' }
  )
  .openapi('ToolboxUpdateBookmark');

export const ToolboxBookmarkIdParamsSchema = z.object({
  bookmarkId: ResourceIdSchema,
});

export const ToolboxBookmarkListQuerySchema = z.object({
  tag: z.string().trim().min(1).max(50).optional(),
});

export const ToolboxInspectTextSchema = z
  .object({
    text: z.string().max(100_000),
  })
  .openapi('ToolboxInspectText');

export const ToolboxTextInspectionSchema = z
  .object({
    codePointCount: z.number().int().nonnegative(),
    utf8ByteCount: z.number().int().nonnegative(),
    wordCount: z.number().int().nonnegative(),
    lineCount: z.number().int().nonnegative(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .openapi('ToolboxTextInspection');
