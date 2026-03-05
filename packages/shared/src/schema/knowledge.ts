import { z } from 'zod';

export const knowledgeDocumentSchema = z.object({
  docId: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
  source: z.string().optional(),
  createdAt: z.string().datetime()
});

export const knowledgeDocumentCreateSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  source: z.string().optional()
});

export const knowledgeRetrieveRequestSchema = z.object({
  query: z.string().min(1),
  topK: z.number().int().min(1).max(20).default(5)
});

export const knowledgeTaskStatusSchema = z.object({
  taskId: z.string().min(1),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  error: z.string().optional()
});

export type KnowledgeDocumentInput = z.infer<typeof knowledgeDocumentSchema>;
export type KnowledgeDocumentCreateInput = z.infer<typeof knowledgeDocumentCreateSchema>;
export type KnowledgeRetrieveRequestInput = z.infer<typeof knowledgeRetrieveRequestSchema>;
