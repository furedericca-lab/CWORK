import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import {
  difyConfigSchema,
  runtimeChatRequestSchema,
  type DifyConfigMaskedView,
  type HealthzResponse,
  type ReadyzResponse,
  type RuntimeSessionsResponse
} from '@cwork/shared';
import { z } from 'zod';
import { AppError } from './errors/app-error';
import { ERROR_CODE } from './errors/error-code';
import { mapErrorToHttp } from './errors/http-error-mapper';
import { createInMemoryRepositories } from './repo/memory';
import type { CoreRepositories } from './repo/interfaces';
import { verifyBearerToken } from './security/auth-middleware';
import { applyRequestIdHeader, genRequestId } from './security/request-id-middleware';
import { redactSensitiveValue } from './security/redact';

const DEFAULT_AUTH_TOKEN = 'dev-token';

const listSessionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

export interface BuildAppOptions {
  authToken?: string;
  repositories?: CoreRepositories;
}

export async function buildApp(options: BuildAppOptions = {}) {
  const authToken = options.authToken ?? process.env.API_AUTH_TOKEN ?? DEFAULT_AUTH_TOKEN;
  const repositories = options.repositories ?? createInMemoryRepositories();

  const app = Fastify({
    logger: true,
    genReqId: (request) => genRequestId(request)
  });

  app.setErrorHandler((error, request, reply) => {
    const errorLike = error instanceof Error ? error : new Error('Unknown error');
    const errorDetails =
      typeof error === 'object' && error !== null && 'details' in error
        ? (error as { details?: unknown }).details
        : undefined;
    const mapped = mapErrorToHttp(error, request.id);
    app.log.error(
      {
        requestId: request.id,
        path: request.url,
        statusCode: mapped.statusCode,
        error: {
          message: errorLike.message,
          stack: errorLike.stack,
          details: redactSensitiveValue(errorDetails)
        }
      },
      'request_failed'
    );

    void reply.code(mapped.statusCode).send(mapped.body);
  });

  await app.register(cors, { origin: true });

  app.addHook('onRequest', async (request, reply) => {
    applyRequestIdHeader(request.id, reply.header.bind(reply));
  });

  const requireAuth = async (request: Parameters<typeof verifyBearerToken>[0]) => {
    verifyBearerToken(request, { token: authToken });
  };

  app.get('/api/v1/healthz', async (): Promise<HealthzResponse> => ({ ok: true }));

  app.get('/api/v1/readyz', async (): Promise<ReadyzResponse> => ({ ok: true, provider: 'dify' }));

  app.get('/api/v1/runtime/sessions', { preHandler: requireAuth }, async (request): Promise<RuntimeSessionsResponse> => {
    const parsedQuery = listSessionsQuerySchema.parse(request.query);
    const result = await repositories.sessions.list(parsedQuery.page, parsedQuery.pageSize);

    return {
      items: result.items.map((item) => ({
        sessionId: item.sessionId,
        displayName: item.displayName,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      })),
      total: result.total,
      page: parsedQuery.page,
      pageSize: parsedQuery.pageSize
    };
  });

  app.get('/api/v1/config/dify', { preHandler: requireAuth }, async (): Promise<DifyConfigMaskedView> => {
    const config = await repositories.difyConfig.get();
    return {
      ...config,
      masked: { difyApiKey: config.difyApiKey ? '***' : '' }
    };
  });

  app.put('/api/v1/config/dify', { preHandler: requireAuth }, async (request): Promise<DifyConfigMaskedView> => {
    const parsed = difyConfigSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, 'Invalid dify config payload', parsed.error.flatten());
    }

    const nextConfig = {
      providerId: parsed.data.providerId,
      difyApiBase: parsed.data.difyApiBase,
      difyApiType: parsed.data.difyApiType,
      difyWorkflowOutputKey: parsed.data.difyWorkflowOutputKey,
      difyQueryInputKey: parsed.data.difyQueryInputKey,
      timeoutSec: parsed.data.timeoutSec,
      variables: parsed.data.variables,
      ...(parsed.data.difyApiKey ? { difyApiKey: parsed.data.difyApiKey } : {})
    };
    const saved = await repositories.difyConfig.set(nextConfig);
    return {
      ...saved,
      masked: { difyApiKey: saved.difyApiKey ? '***' : '' }
    };
  });

  app.post('/api/v1/runtime/chat', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = runtimeChatRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, 'Invalid runtime chat payload', parsed.error.flatten());
    }

    const sessionId = parsed.data.sessionId ?? `sess_${randomUUID()}`;
    const now = new Date().toISOString();
    const existed = await repositories.sessions.findById(sessionId);

    const nextSession = {
      sessionId,
      displayName: existed?.displayName ?? 'default',
      createdAt: existed?.createdAt ?? now,
      updatedAt: now,
      lastActivityAt: now,
      sessionVariables: existed?.sessionVariables ?? {},
      ...(parsed.data.configId ? { activeConfigId: parsed.data.configId } : {}),
      ...(existed?.difyConversationId ? { difyConversationId: existed.difyConversationId } : {})
    };
    await repositories.sessions.upsert(nextSession);

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });

    const send = (event: string, payload: unknown) => {
      reply.raw.write(`event: ${event}\n`);
      reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    send('meta', { requestId: request.id, sessionId, timestamp: now });
    send('delta', { text: 'Scaffold runtime response', index: 0 });
    send('final_result', {
      resultType: 'llm_result',
      messageChain: [{ type: 'plain', text: 'Core scaffold is ready.' }],
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    });
    send('done', { ok: true });
    reply.raw.end();
    return reply;
  });

  return app;
}
