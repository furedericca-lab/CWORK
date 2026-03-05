import { z } from 'zod';

export const pluginImportLocalSchema = z.object({
  path: z.string().min(1)
});

export const pluginImportGitSchema = z.object({
  repoUrl: z.string().min(1),
  ref: z.string().min(1).optional()
});

export const pluginStatusSchema = z.enum(['enabled', 'disabled', 'error']);

export const pluginItemSchema = z.object({
  pluginId: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  source: z.enum(['local', 'git']),
  status: pluginStatusSchema,
  error: z.string().nullable()
});

export type PluginImportLocalInput = z.infer<typeof pluginImportLocalSchema>;
export type PluginImportGitInput = z.infer<typeof pluginImportGitSchema>;
export type PluginItemInput = z.infer<typeof pluginItemSchema>;
