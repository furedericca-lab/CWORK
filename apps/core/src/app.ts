import Fastify from 'fastify';
import cors from '@fastify/cors';
import {
  mcpServerConfigSchema,
  mcpServerNameSchema,
  pluginImportGitSchema,
  pluginImportLocalSchema,
  runtimeChatRequestSchema,
  skillImportRequestSchema,
  toolExecuteRequestSchema,
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
import { McpRuntimeManager } from './mcp/runtime-manager';
import { PermissionPolicy } from './policy/permissions';
import { createInMemoryRepositories } from './repo/memory';
import type { CoreRepositories } from './repo/interfaces';
import { PluginManager } from './plugins/manager';
import { RuntimeChatService } from './runtime/runtime-chat.service';
import { SkillManager } from './skills/manager';
import { verifyBearerToken } from './security/auth-middleware';
import { applyRequestIdHeader, genRequestId } from './security/request-id-middleware';
import { redactSensitiveValue } from './security/redact';
import { createFastifySseWriter } from './sse/fastify-sse';
import { registerBuiltinTools } from './tools/bootstrap';
import { ToolExecutor } from './tools/executor';
import { ToolRegistry } from './tools/registry';

const DEFAULT_AUTH_TOKEN = 'dev-token';

const listSessionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

const skillPathParamSchema = z.object({
  skillId: z.string().min(1)
});

const pluginPathParamSchema = z.object({
  pluginId: z.string().min(1)
});

const createPolicyFromEnv = (): PermissionPolicy => {
  const splitList = (value: string | undefined): string[] =>
    (value ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

  const allowTools = splitList(process.env.CWORK_ALLOW_TOOLS);
  return new PermissionPolicy({
    ...(allowTools.length > 0 ? { allowTools } : {}),
    denyTools: splitList(process.env.CWORK_DENY_TOOLS),
    denyPluginCapabilities: splitList(process.env.CWORK_DENY_PLUGIN_CAPS)
  });
};

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

  const policy = createPolicyFromEnv();
  const mcpManager = new McpRuntimeManager(repositories.mcp);
  const toolRegistry = new ToolRegistry(repositories.tools);
  const toolExecutor = new ToolExecutor(toolRegistry, {
    policy,
    logger: {
      info: (payload, message) => app.log.info(payload, message),
      error: (payload, message) => app.log.error(payload, message)
    }
  });

  const skillManager = new SkillManager(repositories.skills);
  const pluginManager = new PluginManager(repositories.plugins, { policy });

  const app = Fastify({
    logger: true,
    genReqId: (request) => genRequestId(request)
  });

  await registerBuiltinTools(toolRegistry, mcpManager);
  await skillManager.ensureRoot();
  await pluginManager.ensureRoot();

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
    const result = await runtimeChatService.run(
      {
        requestId: request.id,
        request: parsed.data,
        writer
      },
      toolExecutor
    );

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

  app.get('/api/v1/tools', { preHandler: requireAuth }, async () => {
    return {
      items: await toolRegistry.list()
    };
  });

  app.post('/api/v1/tools/execute', { preHandler: requireAuth }, async (request) => {
    const parsed = toolExecuteRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, 'Invalid tool execute payload', parsed.error.flatten());
    }

    const result = await toolExecutor.execute(
      parsed.data.toolName,
      parsed.data.arguments,
      {
        requestId: request.id,
        ...(parsed.data.sessionId ? { sessionId: parsed.data.sessionId } : {})
      },
      {
        onStart: (payload) => app.log.info({ requestId: request.id, ...payload }, 'tool_call_start'),
        onEnd: (payload) => app.log.info({ requestId: request.id, ...payload }, 'tool_call_end')
      }
    );

    return result;
  });

  app.get('/api/v1/tools/mcp/servers', { preHandler: requireAuth }, async () => {
    return {
      items: await mcpManager.listServers()
    };
  });

  app.post('/api/v1/tools/mcp/add', { preHandler: requireAuth }, async (request) => {
    const parsed = mcpServerConfigSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, 'Invalid mcp add payload', parsed.error.flatten());
    }

    return mcpManager.addServer(parsed.data);
  });

  app.post('/api/v1/tools/mcp/update', { preHandler: requireAuth }, async (request) => {
    const parsed = mcpServerConfigSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, 'Invalid mcp update payload', parsed.error.flatten());
    }

    return mcpManager.updateServer(parsed.data);
  });

  app.post('/api/v1/tools/mcp/delete', { preHandler: requireAuth }, async (request) => {
    const parsed = mcpServerNameSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, 'Invalid mcp delete payload', parsed.error.flatten());
    }

    await mcpManager.deleteServer(parsed.data.name);
    return { ok: true };
  });

  app.post('/api/v1/tools/mcp/test', { preHandler: requireAuth }, async (request) => {
    const parsed = mcpServerNameSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, 'Invalid mcp test payload', parsed.error.flatten());
    }

    return mcpManager.testServer(parsed.data.name);
  });

  app.get('/api/v1/skills', { preHandler: requireAuth }, async () => {
    return {
      items: await skillManager.list(),
      promptBlock: await skillManager.buildPromptBlock()
    };
  });

  app.post('/api/v1/skills/reload', { preHandler: requireAuth }, async () => {
    return {
      items: await skillManager.reload()
    };
  });

  app.post('/api/v1/skills/import', { preHandler: requireAuth }, async (request) => {
    const parsed = skillImportRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, 'Invalid skill import payload', parsed.error.flatten());
    }

    return skillManager.importZip(parsed.data.zipPath);
  });

  app.post('/api/v1/skills/:skillId/enable', { preHandler: requireAuth }, async (request) => {
    const parsed = skillPathParamSchema.safeParse(request.params);
    if (!parsed.success) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, 'Invalid skill path params', parsed.error.flatten());
    }

    return skillManager.enable(parsed.data.skillId);
  });

  app.post('/api/v1/skills/:skillId/disable', { preHandler: requireAuth }, async (request) => {
    const parsed = skillPathParamSchema.safeParse(request.params);
    if (!parsed.success) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, 'Invalid skill path params', parsed.error.flatten());
    }

    return skillManager.disable(parsed.data.skillId);
  });

  app.get('/api/v1/skills/:skillId/download', { preHandler: requireAuth }, async (request) => {
    const parsed = skillPathParamSchema.safeParse(request.params);
    if (!parsed.success) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, 'Invalid skill path params', parsed.error.flatten());
    }

    return {
      path: await skillManager.getDownloadPath(parsed.data.skillId)
    };
  });

  app.delete('/api/v1/skills/:skillId', { preHandler: requireAuth }, async (request) => {
    const parsed = skillPathParamSchema.safeParse(request.params);
    if (!parsed.success) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, 'Invalid skill path params', parsed.error.flatten());
    }

    await skillManager.delete(parsed.data.skillId);
    return { ok: true };
  });

  app.get('/api/v1/plugins', { preHandler: requireAuth }, async () => {
    return {
      items: await pluginManager.list()
    };
  });

  app.post('/api/v1/plugins/import/local', { preHandler: requireAuth }, async (request) => {
    const parsed = pluginImportLocalSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, 'Invalid plugin import local payload', parsed.error.flatten());
    }

    return pluginManager.importLocal(parsed.data);
  });

  app.post('/api/v1/plugins/import/git', { preHandler: requireAuth }, async (request) => {
    const parsed = pluginImportGitSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, 'Invalid plugin import git payload', parsed.error.flatten());
    }

    return pluginManager.importGit(parsed.data);
  });

  app.post('/api/v1/plugins/:pluginId/enable', { preHandler: requireAuth }, async (request) => {
    const parsed = pluginPathParamSchema.safeParse(request.params);
    if (!parsed.success) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, 'Invalid plugin path params', parsed.error.flatten());
    }

    return pluginManager.enable(parsed.data.pluginId);
  });

  app.post('/api/v1/plugins/:pluginId/disable', { preHandler: requireAuth }, async (request) => {
    const parsed = pluginPathParamSchema.safeParse(request.params);
    if (!parsed.success) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, 'Invalid plugin path params', parsed.error.flatten());
    }

    return pluginManager.disable(parsed.data.pluginId);
  });

  app.post('/api/v1/plugins/:pluginId/reload', { preHandler: requireAuth }, async (request) => {
    const parsed = pluginPathParamSchema.safeParse(request.params);
    if (!parsed.success) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, 'Invalid plugin path params', parsed.error.flatten());
    }

    return pluginManager.reload(parsed.data.pluginId);
  });

  app.delete('/api/v1/plugins/:pluginId', { preHandler: requireAuth }, async (request) => {
    const parsed = pluginPathParamSchema.safeParse(request.params);
    if (!parsed.success) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, 'Invalid plugin path params', parsed.error.flatten());
    }

    await pluginManager.uninstall(parsed.data.pluginId);
    return { ok: true };
  });

  app.addHook('onClose', async () => {
    await mcpManager.shutdown();
  });

  return app;
}
