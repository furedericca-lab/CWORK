import { z } from 'zod';

export const messagePartSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('plain'), text: z.string().min(1) }),
  z.object({ type: z.literal('image'), path: z.string().optional(), url: z.string().optional(), attachmentId: z.string().optional() }),
  z.object({ type: z.literal('file'), path: z.string().optional(), url: z.string().optional(), attachmentId: z.string().optional(), filename: z.string().optional() }),
  z.object({ type: z.literal('video'), path: z.string().optional(), url: z.string().optional(), attachmentId: z.string().optional() }),
  z.object({ type: z.literal('reply'), messageId: z.union([z.string(), z.number()]) }),
  z.object({ type: z.literal('record'), path: z.string().optional(), url: z.string().optional() })
]);

export const runtimeChatRequestSchema = z.object({
  sessionId: z.string().optional(),
  message: z.union([z.string().min(1), z.array(messagePartSchema).min(1)]),
  enableStreaming: z.boolean().default(true),
  configId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export type RuntimeChatRequestInput = z.infer<typeof runtimeChatRequestSchema>;
