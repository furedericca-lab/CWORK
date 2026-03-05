import { z } from 'zod';

const mcpServerBaseSchema = z.object({
  name: z.string().min(1),
  enabled: z.boolean().default(true),
  transport: z.enum(['stdio', 'http', 'sse']),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  url: z.string().url().optional(),
  timeoutSec: z.number().int().positive().default(15)
});

export const mcpServerConfigSchema = mcpServerBaseSchema.superRefine((value, ctx) => {
  if (value.transport === 'stdio' && !value.command) {
    ctx.addIssue({ code: 'custom', path: ['command'], message: 'command is required for stdio transport' });
  }

  if ((value.transport === 'http' || value.transport === 'sse') && !value.url) {
    ctx.addIssue({ code: 'custom', path: ['url'], message: 'url is required for http/sse transport' });
  }
});

export const mcpServerNameSchema = z.object({
  name: z.string().min(1)
});

export type McpServerConfigInput = z.infer<typeof mcpServerConfigSchema>;
