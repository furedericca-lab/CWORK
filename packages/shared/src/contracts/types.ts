export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'TIMEOUT'
  | 'UPSTREAM_ERROR'
  | 'INTERNAL_ERROR';

export interface ErrorEnvelope {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
    requestId: string;
  };
}

export type MessagePart =
  | { type: 'plain'; text: string }
  | { type: 'image'; path?: string; url?: string; attachmentId?: string }
  | { type: 'file'; path?: string; url?: string; attachmentId?: string; filename?: string }
  | { type: 'video'; path?: string; url?: string; attachmentId?: string }
  | { type: 'reply'; messageId: string | number }
  | { type: 'record'; path?: string; url?: string };

export interface RuntimeChatRequest {
  sessionId?: string;
  message: string | MessagePart[];
  enableStreaming?: boolean;
  configId?: string;
  metadata?: Record<string, unknown>;
}

export interface RuntimeChatErrorEvent {
  code: Exclude<ErrorCode, 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT'>;
  message: string;
  retriable: boolean;
}

export interface RuntimeChatFinalResultEvent {
  resultType: 'llm_result' | 'agent_runner_error';
  messageChain: MessagePart[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface RuntimeSessionItem {
  sessionId: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}

export interface RuntimeSessionsResponse {
  items: RuntimeSessionItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface HealthzResponse {
  ok: true;
}

export interface ReadyzResponse {
  ok: boolean;
  provider: 'dify';
}

export interface DifyConfig {
  providerId: string;
  difyApiKey?: string;
  difyApiBase: string;
  difyApiType: 'chat' | 'agent' | 'chatflow' | 'workflow';
  difyWorkflowOutputKey: string;
  difyQueryInputKey: string;
  timeoutSec: number;
  variables?: Record<string, unknown>;
}

export interface DifyConfigMaskedView extends Omit<DifyConfig, 'difyApiKey'> {
  masked: {
    difyApiKey: string;
  };
}

export type PluginSource = 'local' | 'git';
export type PluginStatus = 'enabled' | 'disabled' | 'error';

export interface PluginItem {
  pluginId: string;
  name: string;
  version: string;
  source: PluginSource;
  status: PluginStatus;
  error: string | null;
}

export interface PluginListResponse {
  items: PluginItem[];
}

export interface PluginImportLocalRequest {
  path: string;
}

export interface PluginImportGitRequest {
  repoUrl: string;
  ref?: string;
}

export interface SkillDescriptor {
  skillId: string;
  name: string;
  description?: string;
  enabled: boolean;
}

export interface SubagentDescriptor {
  subagentId: string;
  name: string;
  enabled: boolean;
  systemPrompt?: string;
  tools: string[];
}
