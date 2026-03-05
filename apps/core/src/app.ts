import Fastify from 'fastify';
import cors from '@fastify/cors';
import {
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
import { DifyApiClient } from './dify/api-client';
import { DifyConfigService } from './dify/dify-config.service';
import { createInMemoryRepositories } from './repo/memory';
import type { CoreRepositories } from './repo/interfaces';
import { RuntimeChatService } from './runtime/runtime-chat.service';
import { verifyBearerToken } from './security/auth-middleware';
import { applyRequestIdHeader, genRequestId } from './security/request-id-middleware';
import { redactSensitiveValue } from './security/redact';
import { createFastifySseWriter } from './sse/fastify-sse';

const DEFAULT_AUTH_TOKEN = 'dev-token';

const listSessionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

export interface BuildAppOptions {
  authToken?: string;
  repositories?: CoreRepositories;
  difyApiClient?: DifyApiClient;
}

export async function buildApp(options: BuildAppOptions = {}) {
  const authToken = options.authToken ?? process.env.API_AUTH_TOKEN ?? DEFAULT_AUTH_TOKEN;
  const repositories = options.repositories ?? createInMemoryRepositories();
  const difyConfigService = new DifyConfigService(repositories.difyConfig);
  const runtimeChatService = new RuntimeChatService(repositories, options.difyApiClient);

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
    return difyConfigService.getMaskedConfig();
  });

  app.put('/api/v1/config/dify', { preHandler: requireAuth }, async (request): Promise<DifyConfigMaskedView> => {
    return difyConfigService.updateConfig(request.body);
  });

  app.post('/api/v1/runtime/chat', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = runtimeChatRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, 'Invalid runtime chat payload', parsed.error.flatten());
    }

    const runtimeStart = Date.now();
    const writer = createFastifySseWriter(reply);
    const result = await runtimeChatService.run({
      requestId: request.id,
      request: parsed.data,
      writer
    });

    app.log.info(
      {
        requestId: request.id,
        sessionId: result.sessionId,
        runtimeMs: Date.now() - runtimeStart
      },
      'runtime_chat_completed'
    );
    return reply;
  });

  return app;
}
