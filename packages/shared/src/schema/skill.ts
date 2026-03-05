import { z } from 'zod';

export const skillDescriptorSchema = z.object({
  skillId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  enabled: z.boolean()
});

export type SkillDescriptorInput = z.infer<typeof skillDescriptorSchema>;
