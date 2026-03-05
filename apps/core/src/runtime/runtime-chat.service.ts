import { randomUUID } from 'node:crypto';
import type { RuntimeChatRequestInput } from '@cwork/shared';
import { DifyApiClient } from '../dify/api-client';
import { DifyConfigService } from '../dify/dify-config.service';
import { DifyRunner } from '../dify/runner';
import { createDefaultPipelineScheduler } from '../pipeline/factory';
import type { RuntimePipelineContext } from '../pipeline/types';
import type { CoreRepositories, SessionRecord } from '../repo/interfaces';
import type { SseWriter } from '../sse/writer';

interface RunRuntimeChatInput {
  requestId: string;
  request: RuntimeChatRequestInput;
  writer: SseWriter;
}

export class RuntimeChatService {
  private readonly difyConfigService: DifyConfigService;
  private readonly difyRunner: DifyRunner;

  constructor(private readonly repositories: CoreRepositories, apiClient?: DifyApiClient) {
    this.difyConfigService = new DifyConfigService(repositories.difyConfig);
    this.difyRunner = new DifyRunner(this.difyConfigService, apiClient ?? new DifyApiClient());
  }

  async run(input: RunRuntimeChatInput): Promise<{ sessionId: string }> {
    const receivedAt = new Date().toISOString();
    const sessionId = input.request.sessionId ?? `sess_${randomUUID()}`;
    const session = await this.ensureSession(sessionId, input.request, receivedAt);

    const context: RuntimePipelineContext = {
      requestId: input.requestId,
      sessionId,
      receivedAt,
      request: input.request,
      normalizedMessage: [],
      session,
      sseEvents: [],
      writer: input.writer,
      state: {}
    };

    const scheduler = createDefaultPipelineScheduler(this.difyRunner, this.repositories);
    await scheduler.execute(context);

    return { sessionId };
  }

  private async ensureSession(sessionId: string, request: RuntimeChatRequestInput, now: string): Promise<SessionRecord> {
    const existing = await this.repositories.sessions.findById(sessionId);

    const runtimeSessionVariables =
      typeof request.metadata?.sessionVariables === 'object' &&
      request.metadata?.sessionVariables !== null &&
      !Array.isArray(request.metadata.sessionVariables)
        ? (request.metadata.sessionVariables as Record<string, unknown>)
        : {};

    const baseSession: SessionRecord =
      existing ?? {
        sessionId,
        displayName: 'default',
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now,
        sessionVariables: {}
      };

    const nextSession: SessionRecord = {
      ...baseSession,
      updatedAt: now,
      lastActivityAt: now,
      sessionVariables: {
        ...baseSession.sessionVariables,
        ...runtimeSessionVariables
      },
      ...(request.configId ? { activeConfigId: request.configId } : {}),
      ...(baseSession.difyConversationId ? { difyConversationId: baseSession.difyConversationId } : {})
    };

    await this.repositories.sessions.upsert(nextSession);
    return nextSession;
  }
}
