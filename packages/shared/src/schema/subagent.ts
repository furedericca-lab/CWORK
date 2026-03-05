import { z } from 'zod';

export const subagentDescriptorSchema = z.object({
  subagentId: z.string().min(1),
  name: z.string().min(1),
  enabled: z.boolean(),
  systemPrompt: z.string().optional(),
  tools: z.array(z.string().min(1)).default([])
});

export const subagentHandoffSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  reason: z.string().min(1)
});

export type SubagentDescriptorInput = z.infer<typeof subagentDescriptorSchema>;
export type SubagentHandoffInput = z.infer<typeof subagentHandoffSchema>;
