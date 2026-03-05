import { z } from 'zod';

export const capabilityStateSchema = z.object({
  enabled: z.boolean(),
  healthy: z.boolean(),
  lastCheckAt: z.string().datetime().optional(),
  lastError: z.string().optional()
});

export const capabilityStatusResponseSchema = z.object({
  dify: capabilityStateSchema,
  plugins: capabilityStateSchema,
  skills: capabilityStateSchema,
  mcp: capabilityStateSchema,
  search: capabilityStateSchema,
  knowledge: capabilityStateSchema,
  sandbox: capabilityStateSchema
});

export type CapabilityStateInput = z.infer<typeof capabilityStateSchema>;
export type CapabilityStatusResponseInput = z.infer<typeof capabilityStatusResponseSchema>;
