import { z } from 'zod';

export const difyConfigSchema = z.object({
  providerId: z.string().min(1),
  difyApiKey: z.string().min(1).optional(),
  difyApiBase: z.url(),
  difyApiType: z.enum(['chat', 'agent', 'chatflow', 'workflow']),
  difyWorkflowOutputKey: z.string().min(1),
  difyQueryInputKey: z.string().min(1),
  timeoutSec: z.number().int().positive(),
  variables: z.record(z.string(), z.unknown()).default({})
});

export type DifyConfigInput = z.infer<typeof difyConfigSchema>;
