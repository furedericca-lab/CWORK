import { z } from 'zod';

export const subagentDescriptorSchema = z.object({
  subagentId: z.string().min(1),
  name: z.string().min(1),
  enabled: z.boolean(),
  providerId: z.string().min(1).optional(),
  systemPrompt: z.string().optional(),
  publicDescription: z.string().optional(),
  tools: z.array(z.string().min(1)).default([])
});

export const subagentHandoffSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  reason: z.string().min(1)
});

const subagentConfigRawSchema = z.object({
  mainEnable: z.boolean().default(true),
  removeMainDuplicateTools: z.boolean().default(false),
  routerSystemPrompt: z.string().min(1).optional(),
  agents: z.array(subagentDescriptorSchema).default([])
});

export const subagentConfigSchema = z.preprocess((input) => {
  if (typeof input !== 'object' || input === null) {
    return input;
  }

  const source = input as Record<string, unknown>;
  if ('enable' in source && !('mainEnable' in source)) {
    return {
      ...source,
      mainEnable: source.enable
    };
  }

  return source;
}, subagentConfigRawSchema);

export type SubagentDescriptorInput = z.infer<typeof subagentDescriptorSchema>;
export type SubagentHandoffInput = z.infer<typeof subagentHandoffSchema>;
export type SubagentConfigInput = z.infer<typeof subagentConfigSchema>;
