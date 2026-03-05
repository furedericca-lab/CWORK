import { z } from 'zod';

export const proactiveJobStatusSchema = z.enum(['pending', 'running', 'succeeded', 'failed', 'cancelled']);

export const proactiveJobSchema = z.object({
  jobId: z.string().min(1),
  name: z.string().min(1),
  sessionId: z.string().min(1),
  prompt: z.string().min(1),
  cronExpression: z.string().min(1).optional(),
  runOnce: z.boolean(),
  runAt: z.string().datetime().optional(),
  timezone: z.string().min(1).optional(),
  enabled: z.boolean().default(true),
  status: proactiveJobStatusSchema.default('pending'),
  updatedAt: z.string().datetime(),
  lastRunAt: z.string().datetime().optional(),
  lastError: z.string().optional()
});

export const proactiveJobCreateRequestSchema = z
  .object({
    name: z.string().min(1),
    sessionId: z.string().min(1),
    prompt: z.string().min(1),
    cronExpression: z.string().min(1).optional(),
    runOnce: z.boolean().optional(),
    runAt: z.string().datetime().optional(),
    timezone: z.string().min(1).optional(),
    enabled: z.boolean().optional()
  })
  .superRefine((value, ctx) => {
    if (!value.cronExpression && !value.runAt) {
      ctx.addIssue({
        code: 'custom',
        path: ['cronExpression'],
        message: 'Either cronExpression or runAt is required'
      });
    }
  });

export type ProactiveJobInput = z.infer<typeof proactiveJobSchema>;
export type ProactiveJobCreateRequestInput = z.infer<typeof proactiveJobCreateRequestSchema>;
