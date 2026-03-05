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
    details?: Record<string, unknown> | undefined;
    requestId: string;
  };
}

export type MessagePart =
  | { type: 'plain'; text: string }
  | { type: 'image'; path?: string | undefined; url?: string | undefined; attachmentId?: string | undefined }
  | {
      type: 'file';
      path?: string | undefined;
      url?: string | undefined;
      attachmentId?: string | undefined;
      filename?: string | undefined;
    }
  | { type: 'video'; path?: string | undefined; url?: string | undefined; attachmentId?: string | undefined }
  | { type: 'reply'; messageId: string | number }
  | { type: 'record'; path?: string | undefined; url?: string | undefined };

export interface RuntimeChatRequest {
  sessionId?: string | undefined;
  message: string | MessagePart[];
  enableStreaming?: boolean | undefined;
  configId?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
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
  } | undefined;
}

export interface RuntimeChatMetaEvent {
  requestId: string;
  sessionId: string;
  timestamp: string;
}

export interface RuntimeChatDeltaEvent {
  text: string;
  index: number;
}

export interface RuntimeToolCallTraceEvent {
  toolName: string;
  callId: string;
  arguments?: Record<string, unknown>;
  ok?: boolean;
  result?: Record<string, unknown>;
}

export interface RuntimeHandoffEvent {
  from: string;
  to: string;
  reason: string;
}

export interface RuntimeCapabilityTraceEvent {
  type: 'knowledge' | 'search' | 'mcp' | 'sandbox';
  status: 'start' | 'finish' | 'error';
  data?: Record<string, unknown>;
}

export type RuntimeSseEventName =
  | 'meta'
  | 'delta'
  | 'tool_call_start'
  | 'tool_call_end'
  | 'handoff'
  | 'capability'
  | 'final_result'
  | 'error'
  | 'done';

export type RuntimeSseEventPayloadMap = {
  meta: RuntimeChatMetaEvent;
  delta: RuntimeChatDeltaEvent;
  tool_call_start: RuntimeToolCallTraceEvent;
  tool_call_end: RuntimeToolCallTraceEvent;
  handoff: RuntimeHandoffEvent;
  capability: RuntimeCapabilityTraceEvent;
  final_result: RuntimeChatFinalResultEvent;
  error: RuntimeChatErrorEvent;
  done: { ok: true };
};

export type RuntimeSseEvent = {
  [K in RuntimeSseEventName]: {
    event: K;
    data: RuntimeSseEventPayloadMap[K];
  };
}[RuntimeSseEventName];

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
  difyApiKey?: string | undefined;
  difyApiBase: string;
  difyApiType: 'chat' | 'agent' | 'chatflow' | 'workflow';
  difyWorkflowOutputKey: string;
  difyQueryInputKey: string;
  timeoutSec: number;
  variables?: Record<string, unknown> | undefined;
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
  ref?: string | undefined;
}

export interface ToolSchemaField {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean | undefined;
  description?: string | undefined;
}

export interface ToolItem {
  toolName: string;
  description: string;
  enabled: boolean;
  schema: Record<string, ToolSchemaField>;
  source: 'builtin' | 'mcp' | 'plugin';
}

export interface ToolListResponse {
  items: ToolItem[];
}

export interface ToolExecuteRequest {
  toolName: string;
  arguments: Record<string, unknown>;
  sessionId?: string | undefined;
}

export interface ToolExecuteResponse {
  ok: boolean;
  output?: unknown;
  error?: {
    code: ErrorCode;
    message: string;
  };
}

export type McpTransportType = 'stdio' | 'http' | 'sse';

export interface McpServerConfig {
  name: string;
  enabled: boolean;
  transport: McpTransportType;
  command?: string | undefined;
  args?: string[] | undefined;
  url?: string | undefined;
  timeoutSec?: number | undefined;
}

export interface McpServerRuntimeState {
  name: string;
  enabled: boolean;
  healthy: boolean;
  lastCheckAt?: string | undefined;
  lastError?: string | undefined;
}

export interface McpServerListResponse {
  items: Array<McpServerConfig & { runtime: McpServerRuntimeState }>;
}

export interface SkillDescriptor {
  skillId: string;
  name: string;
  scope?: 'local_only' | 'sandbox_only' | 'both' | undefined;
  description?: string | undefined;
  enabled: boolean;
}

export interface SubagentDescriptor {
  subagentId: string;
  name: string;
  enabled: boolean;
  systemPrompt?: string | undefined;
  tools: string[];
}

export interface SubagentConfigAgent {
  subagentId: string;
  name: string;
  enabled: boolean;
  providerId?: string | undefined;
  systemPrompt?: string | undefined;
  publicDescription?: string | undefined;
  tools: string[];
}

export interface SubagentConfig {
  mainEnable: boolean;
  removeMainDuplicateTools: boolean;
  routerSystemPrompt?: string | undefined;
  agents: SubagentConfigAgent[];
}

export interface ProactiveJob {
  jobId: string;
  name: string;
  sessionId: string;
  prompt: string;
  cronExpression?: string | undefined;
  runOnce: boolean;
  runAt?: string | undefined;
  timezone?: string | undefined;
  enabled: boolean;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  updatedAt: string;
  lastRunAt?: string | undefined;
  lastError?: string | undefined;
}

export interface ProactiveJobCreateRequest {
  name: string;
  sessionId: string;
  prompt: string;
  cronExpression?: string | undefined;
  runOnce?: boolean | undefined;
  runAt?: string | undefined;
  timezone?: string | undefined;
  enabled?: boolean | undefined;
}

export interface ProactiveJobListResponse {
  items: ProactiveJob[];
}

export interface CapabilityState {
  enabled: boolean;
  healthy: boolean;
  lastCheckAt?: string | undefined;
  lastError?: string | undefined;
}

export interface CapabilityStatusResponse {
  dify: CapabilityState;
  plugins: CapabilityState;
  skills: CapabilityState;
  mcp: CapabilityState;
  search: CapabilityState;
  knowledge: CapabilityState;
  sandbox: CapabilityState;
}

export interface KnowledgeDocument {
  docId: string;
  title: string;
  content: string;
  source?: string | undefined;
  createdAt: string;
}

export interface KnowledgeTaskStatus {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
  error?: string | undefined;
}

export interface KnowledgeRetrieveRequest {
  query: string;
  topK?: number | undefined;
}

export interface KnowledgeRetrieveItem {
  docId: string;
  title: string;
  snippet: string;
  score: number;
  citation?: string | undefined;
}

export interface KnowledgeRetrieveResponse {
  items: KnowledgeRetrieveItem[];
}
