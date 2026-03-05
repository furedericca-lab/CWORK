import { z } from 'zod';

export const toolSchemaFieldSchema = z.object({
  type: z.enum(['string', 'number', 'boolean', 'object', 'array']),
  required: z.boolean().optional(),
  description: z.string().optional()
});

export const toolItemSchema = z.object({
  toolName: z.string().min(1),
  description: z.string().min(1),
  enabled: z.boolean(),
  schema: z.record(z.string(), toolSchemaFieldSchema).default({}),
  source: z.enum(['builtin', 'mcp', 'plugin'])
});

export const toolExecuteRequestSchema = z.object({
  toolName: z.string().min(1),
  arguments: z.record(z.string(), z.unknown()).default({}),
  sessionId: z.string().optional()
});

export type ToolItemInput = z.infer<typeof toolItemSchema>;
export type ToolExecuteRequestInput = z.infer<typeof toolExecuteRequestSchema>;
