import type {
  CapabilityStatusResponse,
  DifyConfig,
  DifyConfigMaskedView,
  ErrorEnvelope,
  HealthzResponse,
  KnowledgeDocument,
  KnowledgeRetrieveRequest,
  KnowledgeRetrieveResponse,
  KnowledgeTaskStatus,
  McpServerConfig,
  McpServerListResponse,
  PluginImportGitRequest,
  PluginImportLocalRequest,
  PluginItem,
  ProactiveJob,
  ProactiveJobCreateRequest,
  ReadyzResponse,
  RuntimeChatRequest,
  RuntimeSseEventName,
  RuntimeSseEventPayloadMap,
  RuntimeSessionsResponse,
  SkillDescriptor,
  SubagentConfig,
  ToolExecuteRequest,
  ToolExecuteResponse,
  ToolItem,
  ToolListResponse
} from '@cwork/shared';

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api/v1';

const REQUEST_ID_HEADER = 'x-request-id';
const FALLBACK_AUTH_TOKEN = 'dev-token';

const runtimeSseEvents: ReadonlySet<string> = new Set<RuntimeSseEventName>([
  'meta',
  'delta',
  'tool_call_start',
  'tool_call_end',
  'handoff',
  'capability',
  'final_result',
  'error',
  'done'
]);

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface RequestTraceEntry {
  requestId: string;
  method: HttpMethod;
  path: string;
  statusCode: number;
  ok: boolean;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  errorMessage?: string | undefined;
}

interface ApiClientConfig {
  baseUrl?: string;
  getAuthToken?: (() => string | undefined) | undefined;
  onTrace?: ((entry: RequestTraceEntry) => void) | undefined;
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly requestId: string;
  readonly payload: ErrorEnvelope | undefined;

  constructor(message: string, statusCode: number, requestId: string, payload?: ErrorEnvelope) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.requestId = requestId;
    this.payload = payload;
  }
}

interface RequestOptions {
  method?: HttpMethod | undefined;
  body?: unknown;
  headers?: HeadersInit | undefined;
}

export interface RuntimeSseEventEnvelope<K extends RuntimeSseEventName = RuntimeSseEventName> {
  event: K;
  data: RuntimeSseEventPayloadMap[K];
}

export interface RuntimeChatStreamHandlers {
  onEvent: <K extends RuntimeSseEventName>(event: RuntimeSseEventEnvelope<K>) => void;
}

interface ParsedSseEvent {
  event: string;
  data: string;
}

const createTraceRequestId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `web_${crypto.randomUUID()}`;
  }
  return `web_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

const parseJsonSafe = async <T>(response: Response): Promise<T | undefined> => {
  const text = await response.text();
  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
};

export const parseSseBlocks = (
  input: string
): {
  events: ParsedSseEvent[];
  rest: string;
} => {
  const events: ParsedSseEvent[] = [];
  const blocks = input.split('\n\n');
  const rest = blocks.pop() ?? '';

  for (const block of blocks) {
    const lines = block.split('\n');
    let eventName = '';
    const dataLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventName = line.slice('event:'.length).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice('data:'.length).trimStart());
      }
    }

    if (!eventName || dataLines.length === 0) {
      continue;
    }

    events.push({
      event: eventName,
      data: dataLines.join('\n')
    });
  }

  return { events, rest };
};

class ApiClient {
  private readonly baseUrl: string;
  private readonly getAuthToken: (() => string | undefined) | undefined;
  private readonly onTrace: ((entry: RequestTraceEntry) => void) | undefined;

  constructor(config: ApiClientConfig = {}) {
    this.baseUrl = config.baseUrl ?? API_BASE;
    this.getAuthToken = config.getAuthToken;
    this.onTrace = config.onTrace;
  }

  private resolveToken(): string | undefined {
    const explicit = this.getAuthToken?.()?.trim();
    if (explicit) {
      return explicit;
    }
    return FALLBACK_AUTH_TOKEN;
  }

  private buildHeaders(initHeaders: HeadersInit | undefined, requestId: string): Headers {
    const headers = new Headers(initHeaders);
    headers.set(REQUEST_ID_HEADER, requestId);
    headers.set('Accept', 'application/json');
    const token = this.resolveToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  private emitTrace(entry: RequestTraceEntry): void {
    this.onTrace?.(entry);
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const method = options.method ?? 'GET';
    const requestId = createTraceRequestId();
    const started = Date.now();
    const startedAt = new Date(started).toISOString();

    const headers = this.buildHeaders(options.headers, requestId);
    if (options.body !== undefined) {
      headers.set('Content-Type', 'application/json');
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: options.body === undefined ? null : JSON.stringify(options.body)
      });
    } catch (error) {
      const ended = Date.now();
      this.emitTrace({
        requestId,
        method,
        path,
        statusCode: 0,
        ok: false,
        startedAt,
        endedAt: new Date(ended).toISOString(),
        durationMs: ended - started,
        errorMessage: error instanceof Error ? error.message : String(error)
      });
      throw new ApiError(error instanceof Error ? error.message : 'Network request failed', 0, requestId);
    }

    const responseRequestId = response.headers.get(REQUEST_ID_HEADER) ?? requestId;
    const ended = Date.now();
    const endedAt = new Date(ended).toISOString();

    if (!response.ok) {
      const payload = await parseJsonSafe<ErrorEnvelope>(response);
      const message = payload?.error.message ?? `Request failed with status ${response.status}`;
      this.emitTrace({
        requestId: responseRequestId,
        method,
        path,
        statusCode: response.status,
        ok: false,
        startedAt,
        endedAt,
        durationMs: ended - started,
        errorMessage: message
      });
      throw new ApiError(message, response.status, responseRequestId, payload);
    }

    const body = await parseJsonSafe<T>(response);
    this.emitTrace({
      requestId: responseRequestId,
      method,
      path,
      statusCode: response.status,
      ok: true,
      startedAt,
      endedAt,
      durationMs: ended - started
    });
    if (body === undefined) {
      throw new ApiError('Expected response body', response.status, responseRequestId);
    }
    return body;
  }

  async streamRuntimeChat(request: RuntimeChatRequest, handlers: RuntimeChatStreamHandlers): Promise<void> {
    const requestId = createTraceRequestId();
    const started = Date.now();
    const startedAt = new Date(started).toISOString();
    const headers = this.buildHeaders(undefined, requestId);
    headers.set('Accept', 'text/event-stream');
    headers.set('Content-Type', 'application/json');

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/runtime/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request)
      });
    } catch (error) {
      const ended = Date.now();
      this.emitTrace({
        requestId,
        method: 'POST',
        path: '/runtime/chat',
        statusCode: 0,
        ok: false,
        startedAt,
        endedAt: new Date(ended).toISOString(),
        durationMs: ended - started,
        errorMessage: error instanceof Error ? error.message : String(error)
      });
      throw new ApiError(error instanceof Error ? error.message : 'Network request failed', 0, requestId);
    }

    const responseRequestId = response.headers.get(REQUEST_ID_HEADER) ?? requestId;
    if (!response.ok) {
      const payload = await parseJsonSafe<ErrorEnvelope>(response);
      const ended = Date.now();
      const message = payload?.error.message ?? `Request failed with status ${response.status}`;
      this.emitTrace({
        requestId: responseRequestId,
        method: 'POST',
        path: '/runtime/chat',
        statusCode: response.status,
        ok: false,
        startedAt,
        endedAt: new Date(ended).toISOString(),
        durationMs: ended - started,
        errorMessage: message
      });
      throw new ApiError(message, response.status, responseRequestId, payload);
    }

    if (!response.body) {
      throw new ApiError('SSE response body is empty', response.status, responseRequestId);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const chunk = await reader.read();
      if (chunk.done) {
        break;
      }

      buffer += decoder.decode(chunk.value, { stream: true });
      const parsed = parseSseBlocks(buffer);
      buffer = parsed.rest;

      for (const event of parsed.events) {
        if (!runtimeSseEvents.has(event.event)) {
          continue;
        }

        try {
          const parsedData = JSON.parse(event.data) as RuntimeSseEventPayloadMap[RuntimeSseEventName];
          handlers.onEvent({
            event: event.event as RuntimeSseEventName,
            data: parsedData
          });
        } catch {
          // Ignore malformed event payloads without breaking stream consumption.
        }
      }
    }

    const ended = Date.now();
    this.emitTrace({
      requestId: responseRequestId,
      method: 'POST',
      path: '/runtime/chat',
      statusCode: response.status,
      ok: true,
      startedAt,
      endedAt: new Date(ended).toISOString(),
      durationMs: ended - started
    });
  }

  getHealthz(): Promise<HealthzResponse> {
    return this.request<HealthzResponse>('/healthz');
  }

  getReadyz(): Promise<ReadyzResponse> {
    return this.request<ReadyzResponse>('/readyz');
  }

  getRuntimeSessions(page = 1, pageSize = 20): Promise<RuntimeSessionsResponse> {
    return this.request<RuntimeSessionsResponse>(`/runtime/sessions?page=${page}&pageSize=${pageSize}`);
  }

  getDifyConfig(): Promise<DifyConfigMaskedView> {
    return this.request<DifyConfigMaskedView>('/config/dify');
  }

  updateDifyConfig(payload: DifyConfig): Promise<DifyConfigMaskedView> {
    return this.request<DifyConfigMaskedView>('/config/dify', {
      method: 'PUT',
      body: payload
    });
  }

  listPlugins(): Promise<{ items: PluginItem[] }> {
    return this.request<{ items: PluginItem[] }>('/plugins');
  }

  importPluginLocal(payload: PluginImportLocalRequest): Promise<PluginItem> {
    return this.request<PluginItem>('/plugins/import/local', {
      method: 'POST',
      body: payload
    });
  }

  importPluginGit(payload: PluginImportGitRequest): Promise<PluginItem> {
    return this.request<PluginItem>('/plugins/import/git', {
      method: 'POST',
      body: payload
    });
  }

  enablePlugin(pluginId: string): Promise<PluginItem> {
    return this.request<PluginItem>(`/plugins/${encodeURIComponent(pluginId)}/enable`, { method: 'POST' });
  }

  disablePlugin(pluginId: string): Promise<PluginItem> {
    return this.request<PluginItem>(`/plugins/${encodeURIComponent(pluginId)}/disable`, { method: 'POST' });
  }

  reloadPlugin(pluginId: string): Promise<PluginItem> {
    return this.request<PluginItem>(`/plugins/${encodeURIComponent(pluginId)}/reload`, { method: 'POST' });
  }

  uninstallPlugin(pluginId: string): Promise<{ ok: true }> {
    return this.request<{ ok: true }>(`/plugins/${encodeURIComponent(pluginId)}`, { method: 'DELETE' });
  }

  listSkills(): Promise<{ items: SkillDescriptor[]; promptBlock: string }> {
    return this.request<{ items: SkillDescriptor[]; promptBlock: string }>('/skills');
  }

  reloadSkills(): Promise<{ items: SkillDescriptor[] }> {
    return this.request<{ items: SkillDescriptor[] }>('/skills/reload', { method: 'POST' });
  }

  importSkill(zipPath: string): Promise<SkillDescriptor> {
    return this.request<SkillDescriptor>('/skills/import', { method: 'POST', body: { zipPath } });
  }

  enableSkill(skillId: string): Promise<SkillDescriptor> {
    return this.request<SkillDescriptor>(`/skills/${encodeURIComponent(skillId)}/enable`, { method: 'POST' });
  }

  disableSkill(skillId: string): Promise<SkillDescriptor> {
    return this.request<SkillDescriptor>(`/skills/${encodeURIComponent(skillId)}/disable`, { method: 'POST' });
  }

  deleteSkill(skillId: string): Promise<{ ok: true }> {
    return this.request<{ ok: true }>(`/skills/${encodeURIComponent(skillId)}`, { method: 'DELETE' });
  }

  getSkillDownloadPath(skillId: string): Promise<{ path: string }> {
    return this.request<{ path: string }>(`/skills/${encodeURIComponent(skillId)}/download`);
  }

  listTools(): Promise<ToolListResponse> {
    return this.request<ToolListResponse>('/tools');
  }

  reloadTools(): Promise<ToolListResponse> {
    return this.request<ToolListResponse>('/tools/reload', { method: 'POST' });
  }

  enableTool(toolName: string): Promise<ToolItem> {
    return this.request<ToolItem>(`/tools/${encodeURIComponent(toolName)}/enable`, { method: 'POST' });
  }

  disableTool(toolName: string): Promise<ToolItem> {
    return this.request<ToolItem>(`/tools/${encodeURIComponent(toolName)}/disable`, { method: 'POST' });
  }

  deleteTool(toolName: string): Promise<{ ok: true }> {
    return this.request<{ ok: true }>(`/tools/${encodeURIComponent(toolName)}`, { method: 'DELETE' });
  }

  executeTool(payload: ToolExecuteRequest): Promise<ToolExecuteResponse> {
    return this.request<ToolExecuteResponse>('/tools/execute', { method: 'POST', body: payload });
  }

  listMcpServers(): Promise<McpServerListResponse> {
    return this.request<McpServerListResponse>('/tools/mcp/servers');
  }

  addMcpServer(payload: McpServerConfig): Promise<McpServerConfig> {
    return this.request<McpServerConfig>('/tools/mcp/add', { method: 'POST', body: payload });
  }

  updateMcpServer(payload: McpServerConfig): Promise<McpServerConfig> {
    return this.request<McpServerConfig>('/tools/mcp/update', { method: 'POST', body: payload });
  }

  testMcpServer(name: string): Promise<{ ok: boolean; error?: string | undefined }> {
    return this.request<{ ok: boolean; error?: string | undefined }>('/tools/mcp/test', { method: 'POST', body: { name } });
  }

  enableMcpServer(name: string): Promise<{ ok: true }> {
    return this.request<{ ok: true }>('/tools/mcp/enable', { method: 'POST', body: { name } });
  }

  disableMcpServer(name: string): Promise<{ ok: true }> {
    return this.request<{ ok: true }>('/tools/mcp/disable', { method: 'POST', body: { name } });
  }

  deleteMcpServer(name: string): Promise<{ ok: true }> {
    return this.request<{ ok: true }>('/tools/mcp/delete', { method: 'POST', body: { name } });
  }

  getSubagents(): Promise<SubagentConfig> {
    return this.request<SubagentConfig>('/subagents');
  }

  updateSubagents(payload: SubagentConfig): Promise<SubagentConfig> {
    return this.request<SubagentConfig>('/subagents', { method: 'PUT', body: payload });
  }

  getSubagentAvailableTools(): Promise<{ items: ToolItem[] }> {
    return this.request<{ items: ToolItem[] }>('/subagents/available-tools');
  }

  listProactiveJobs(): Promise<{ items: ProactiveJob[] }> {
    return this.request<{ items: ProactiveJob[] }>('/proactive/jobs');
  }

  createProactiveJob(payload: ProactiveJobCreateRequest): Promise<ProactiveJob> {
    return this.request<ProactiveJob>('/proactive/jobs', { method: 'POST', body: payload });
  }

  deleteProactiveJob(jobId: string): Promise<{ ok: true }> {
    return this.request<{ ok: true }>(`/proactive/jobs/${encodeURIComponent(jobId)}`, { method: 'DELETE' });
  }

  getCapabilityStatus(): Promise<CapabilityStatusResponse> {
    return this.request<CapabilityStatusResponse>('/capabilities/status');
  }

  listKnowledgeDocuments(): Promise<{ items: KnowledgeDocument[] }> {
    return this.request<{ items: KnowledgeDocument[] }>('/kb/documents');
  }

  createKnowledgeDocument(payload: {
    title: string;
    content: string;
    source?: string | undefined;
  }): Promise<{ document: KnowledgeDocument; task: KnowledgeTaskStatus }> {
    return this.request<{ document: KnowledgeDocument; task: KnowledgeTaskStatus }>('/kb/documents', {
      method: 'POST',
      body: payload
    });
  }

  getKnowledgeTask(taskId: string): Promise<KnowledgeTaskStatus> {
    return this.request<KnowledgeTaskStatus>(`/kb/tasks/${encodeURIComponent(taskId)}`);
  }

  retrieveKnowledge(payload: KnowledgeRetrieveRequest): Promise<KnowledgeRetrieveResponse> {
    return this.request<KnowledgeRetrieveResponse>('/kb/retrieve', { method: 'POST', body: payload });
  }

  deleteKnowledgeDocument(docId: string): Promise<{ ok: true }> {
    return this.request<{ ok: true }>(`/kb/documents/${encodeURIComponent(docId)}`, { method: 'DELETE' });
  }
}

export const createApiClient = (config?: ApiClientConfig): ApiClient => new ApiClient(config);
