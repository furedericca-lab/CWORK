import Fastify from 'fastify';
import cors from '@fastify/cors';
import { runtimeChatRequestSchema, type RuntimeSessionItem } from '@easywork/shared';
import { randomUUID } from 'node:crypto';

const sessions: RuntimeSessionItem[] = [];

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });

  app.get('/api/v1/healthz', async () => ({ ok: true }));

  app.get('/api/v1/readyz', async () => ({ ok: true, provider: 'dify' }));

  app.get('/api/v1/runtime/sessions', async () => ({
    items: sessions,
    total: sessions.length,
    page: 1,
    pageSize: sessions.length
  }));

  app.post('/api/v1/runtime/chat', async (request, reply) => {
    const parsed = runtimeChatRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400);
      return {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid runtime chat payload',
          details: parsed.error.flatten(),
          requestId: request.id
        }
      };
    }

    const sessionId = parsed.data.sessionId ?? `sess_${randomUUID()}`;

    if (!sessions.find((s) => s.sessionId === sessionId)) {
      const now = new Date().toISOString();
      sessions.push({
        sessionId,
        displayName: 'default',
        createdAt: now,
        updatedAt: now
      });
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });

    const send = (event: string, payload: unknown) => {
      reply.raw.write(`event: ${event}\n`);
      reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    send('meta', { requestId: request.id, sessionId, timestamp: new Date().toISOString() });
    send('delta', { text: 'Scaffold runtime response', index: 0 });
    send('final_result', {
      resultType: 'llm_result',
      messageChain: [{ type: 'plain', text: 'Core scaffold is ready.' }]
    });
    send('done', { ok: true });
    reply.raw.end();
    return reply;
  });

  return app;
}
