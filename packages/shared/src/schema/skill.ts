import { z } from 'zod';

export const skillDescriptorSchema = z.object({
  skillId: z.string().min(1),
  name: z.string().min(1),
  scope: z.enum(['local_only', 'sandbox_only', 'both']).default('both'),
  description: z.string().optional(),
  enabled: z.boolean()
});

export const skillImportRequestSchema = z.object({
  zipPath: z.string().min(1)
});

export type SkillDescriptorInput = z.infer<typeof skillDescriptorSchema>;
export type SkillImportRequestInput = z.infer<typeof skillImportRequestSchema>;
