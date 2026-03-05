import type {
  MessagePart,
  RuntimeChatRequestInput,
  RuntimeChatFinalResultEvent,
  RuntimeSseEventName,
  RuntimeSseEvent,
  RuntimeSseEventPayloadMap
} from '@cwork/shared';
import { AppError } from '../errors/app-error';
import { ERROR_CODE } from '../errors/error-code';
import type { SessionRecord } from '../repo/interfaces';
import { mergeDifyVariables } from './variables';
import { DifyApiClient } from './api-client';
import { DifyConfigService } from './dify-config.service';
import type { DifyStreamFrame } from './types';

interface RunDifyRequest {
  requestId: string;
  sessionId: string;
  request: RuntimeChatRequestInput;
  messageChain: MessagePart[];
  session: SessionRecord;
}

interface RunDifyResult {
  events: RuntimeSseEvent[];
  nextSession: SessionRecord;
}

const extractMessageText = (messageChain: MessagePart[]): string => {
  return messageChain
    .map((part) => {
      if (part.type === 'plain') {
        return part.text;
      }
      if (part.type === 'reply') {
        return String(part.messageId);
      }
      return '';
    })
    .join('\n')
    .trim();
};

const usageFromFrame = (frame: DifyStreamFrame): RuntimeChatFinalResultEvent['usage'] | undefined => {
  const usage = frame.metadata?.usage;
  if (!usage) {
    return undefined;
  }

  return {
    promptTokens: usage.prompt_tokens ?? 0,
    completionTokens: usage.completion_tokens ?? 0,
    totalTokens: usage.total_tokens ?? 0
  };
};

const toFallbackOutputText = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const toPartByFileType = (file: Record<string, unknown>): MessagePart => {
  const type = String(file.type ?? file.mime_type ?? 'file').toLowerCase();
  const url = typeof file.url === 'string' ? file.url : undefined;
  const path = typeof file.path === 'string' ? file.path : undefined;
  const attachmentId = typeof file.id === 'string' ? file.id : undefined;
  const filename = typeof file.name === 'string' ? file.name : undefined;

  if (type.includes('image')) {
    return { type: 'image', ...(url ? { url } : {}), ...(path ? { path } : {}), ...(attachmentId ? { attachmentId } : {}) };
  }

  if (type.includes('video')) {
    return { type: 'video', ...(url ? { url } : {}), ...(path ? { path } : {}), ...(attachmentId ? { attachmentId } : {}) };
  }

  return {
    type: 'file',
    ...(url ? { url } : {}),
    ...(path ? { path } : {}),
    ...(attachmentId ? { attachmentId } : {}),
    ...(filename ? { filename } : {})
  };
};

const event = <K extends RuntimeSseEventName>(
  name: K,
  data: RuntimeSseEventPayloadMap[K]
): RuntimeSseEvent =>
  ({
    event: name,
    data
  }) as RuntimeSseEvent;

export class DifyRunner {
  constructor(
    private readonly configService: DifyConfigService,
    private readonly apiClient: DifyApiClient
  ) {}

  async run(input: RunDifyRequest): Promise<RunDifyResult> {
    const config = await this.configService.getConfig();
    const apiKey = await this.configService.getResolvedApiKey();

    const resetConversation = input.request.metadata?.resetConversation === true;
    const currentConversationId = resetConversation ? undefined : input.session.difyConversationId;

    const messageText = extractMessageText(input.messageChain);
    if (!messageText) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, 'Message text cannot be empty after normalization');
    }

    const runtimeVariables =
      typeof input.request.metadata?.runtimeVariables === 'object' &&
      input.request.metadata?.runtimeVariables !== null &&
      !Array.isArray(input.request.metadata.runtimeVariables)
        ? (input.request.metadata.runtimeVariables as Record<string, unknown>)
        : {};

    const variables = mergeDifyVariables(config.variables ?? {}, input.session.sessionVariables, runtimeVariables);

    if (config.difyApiType === 'workflow') {
      return this.runWorkflowMode({
        input,
        config,
        apiKey,
        messageText,
        variables,
        ...(currentConversationId ? { currentConversationId } : {})
      });
    }

    return this.runTextMode({
      input,
      config,
      apiKey,
      messageText,
      variables,
      ...(currentConversationId ? { currentConversationId } : {})
    });
  }

  private async runTextMode(params: {
    input: RunDifyRequest;
    config: Awaited<ReturnType<DifyConfigService['getConfig']>>;
    apiKey: string;
    messageText: string;
    variables: Record<string, unknown>;
    currentConversationId?: string;
  }): Promise<RunDifyResult> {
    const events: RuntimeSseEvent[] = [];
    const payload: Record<string, unknown> = {
      query: params.messageText,
      inputs: {
        ...params.variables,
        [params.config.difyQueryInputKey]: params.messageText
      },
      user: params.input.sessionId,
      ...(params.currentConversationId ? { conversation_id: params.currentConversationId } : {})
    };

    let deltaIndex = 0;
    let aggregateText = '';
    let finalUsage: RuntimeChatFinalResultEvent['usage'];
    let conversationId = params.currentConversationId;

    for await (const frame of this.apiClient.chatMessagesStream({
      apiBase: params.config.difyApiBase,
      apiKey: params.apiKey,
      mode: params.config.difyApiType === 'workflow' ? 'chat' : params.config.difyApiType,
      payload,
      timeoutSec: params.config.timeoutSec
    })) {
      if (frame.event === 'error') {
        events.push(
          event('error', {
            code: 'UPSTREAM_ERROR',
            message: frame.message ?? 'Dify stream returned error frame',
            retriable: true
          })
        );
        break;
      }

      if (frame.conversation_id) {
        conversationId = frame.conversation_id;
      }

      const chunk = frame.delta ?? frame.answer ?? frame.text;
      if (chunk) {
        aggregateText += chunk;
        events.push(
          event('delta', {
            text: chunk,
            index: deltaIndex
          })
        );
        deltaIndex += 1;
      }

      const usage = usageFromFrame(frame);
      if (usage) {
        finalUsage = usage;
      }
    }

    const finalText = aggregateText || 'No response generated by Dify';
    events.push(
      event('final_result', {
        resultType: 'llm_result',
        messageChain: [{ type: 'plain', text: finalText }],
        ...(finalUsage ? { usage: finalUsage } : {})
      })
    );

    return {
      events,
      nextSession: {
        ...params.input.session,
        ...(conversationId ? { difyConversationId: conversationId } : {})
      }
    };
  }

  private async runWorkflowMode(params: {
    input: RunDifyRequest;
    config: Awaited<ReturnType<DifyConfigService['getConfig']>>;
    apiKey: string;
    messageText: string;
    variables: Record<string, unknown>;
    currentConversationId?: string;
  }): Promise<RunDifyResult> {
    const events: RuntimeSseEvent[] = [];
    const payload: Record<string, unknown> = {
      inputs: {
        ...params.variables,
        [params.config.difyQueryInputKey]: params.messageText
      },
      user: params.input.sessionId,
      ...(params.currentConversationId ? { conversation_id: params.currentConversationId } : {})
    };

    let usage: RuntimeChatFinalResultEvent['usage'];
    let conversationId = params.currentConversationId;
    let finalParts: MessagePart[] = [];

    for await (const frame of this.apiClient.workflowRunStream({
      apiBase: params.config.difyApiBase,
      apiKey: params.apiKey,
      payload,
      timeoutSec: params.config.timeoutSec
    })) {
      if (frame.event === 'error') {
        events.push(
          event('error', {
            code: 'UPSTREAM_ERROR',
            message: frame.message ?? 'Dify workflow returned error frame',
            retriable: true
          })
        );
        break;
      }

      if (frame.conversation_id) {
        conversationId = frame.conversation_id;
      }

      const frameUsage = usageFromFrame(frame);
      if (frameUsage) {
        usage = frameUsage;
      }

      const outputs = frame.data?.outputs;
      if (outputs && params.config.difyWorkflowOutputKey in outputs) {
        const output = outputs[params.config.difyWorkflowOutputKey];
        finalParts = [{ type: 'plain', text: toFallbackOutputText(output) }];
      }

      const files = frame.data?.files;
      if (Array.isArray(files) && files.length > 0) {
        finalParts = [...finalParts, ...files.map((file) => toPartByFileType(file))];
      }
    }

    if (finalParts.length === 0) {
      finalParts = [{ type: 'plain', text: 'Workflow finished without explicit output.' }];
    }

    events.push(
      event('final_result', {
        resultType: 'llm_result',
        messageChain: finalParts,
        ...(usage ? { usage } : {})
      })
    );

    return {
      events,
      nextSession: {
        ...params.input.session,
        ...(conversationId ? { difyConversationId: conversationId } : {})
      }
    };
  }
}
