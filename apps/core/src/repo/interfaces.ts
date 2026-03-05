import type {
  CapabilityStatusResponse,
  DifyConfig,
  KnowledgeDocument,
  KnowledgeTaskStatus,
  McpServerConfig,
  McpServerRuntimeState,
  PluginItem,
  ProactiveJob,
  RuntimeSessionItem,
  SubagentConfig,
  SkillDescriptor,
  SubagentDescriptor,
  ToolItem
} from '@cwork/shared';

export interface SessionRecord extends RuntimeSessionItem {
  difyConversationId?: string | undefined;
  sessionVariables: Record<string, unknown>;
  activeConfigId?: string | undefined;
  lastActivityAt: string;
}

export interface SessionRepository {
  list(page: number, pageSize: number): Promise<{ items: SessionRecord[]; total: number }>;
  findById(sessionId: string): Promise<SessionRecord | null>;
  upsert(session: SessionRecord): Promise<void>;
}

export interface DifyConfigRepository {
  get(): Promise<DifyConfig>;
  set(nextConfig: DifyConfig): Promise<DifyConfig>;
}

export interface PluginRepository {
  list(): Promise<PluginItem[]>;
  get(pluginId: string): Promise<PluginItem | null>;
  upsert(item: PluginItem): Promise<void>;
  delete(pluginId: string): Promise<void>;
}

export interface SkillRepository {
  list(): Promise<SkillDescriptor[]>;
  get(skillId: string): Promise<SkillDescriptor | null>;
  upsert(item: SkillDescriptor): Promise<void>;
  delete(skillId: string): Promise<void>;
}

export interface SubagentRepository {
  list(): Promise<SubagentDescriptor[]>;
  get(subagentId: string): Promise<SubagentDescriptor | null>;
  upsert(item: SubagentDescriptor): Promise<void>;
  delete(subagentId: string): Promise<void>;
}

export type ProactiveJobRecord = ProactiveJob;

export interface ProactiveRepository {
  list(): Promise<ProactiveJobRecord[]>;
  get(jobId: string): Promise<ProactiveJobRecord | null>;
  upsert(item: ProactiveJobRecord): Promise<void>;
  delete(jobId: string): Promise<void>;
}

export interface SubagentConfigRepository {
  get(): Promise<SubagentConfig>;
  set(nextConfig: SubagentConfig): Promise<SubagentConfig>;
}

export interface CapabilityStateRepository {
  get(): Promise<CapabilityStatusResponse>;
  set(next: CapabilityStatusResponse): Promise<CapabilityStatusResponse>;
}

export interface KnowledgeRepository {
  listDocuments(): Promise<KnowledgeDocument[]>;
  getDocument(docId: string): Promise<KnowledgeDocument | null>;
  upsertDocument(doc: KnowledgeDocument): Promise<void>;
  deleteDocument(docId: string): Promise<void>;
  listTasks(): Promise<KnowledgeTaskStatus[]>;
  getTask(taskId: string): Promise<KnowledgeTaskStatus | null>;
  upsertTask(task: KnowledgeTaskStatus): Promise<void>;
}

export interface ToolRepository {
  list(): Promise<ToolItem[]>;
  get(toolName: string): Promise<ToolItem | null>;
  upsert(item: ToolItem): Promise<void>;
  delete(toolName: string): Promise<void>;
}

export interface McpRepository {
  list(): Promise<McpServerConfig[]>;
  get(name: string): Promise<McpServerConfig | null>;
  upsert(item: McpServerConfig): Promise<void>;
  delete(name: string): Promise<void>;
  setRuntimeState(name: string, state: McpServerRuntimeState): Promise<void>;
  getRuntimeState(name: string): Promise<McpServerRuntimeState | null>;
}

export interface CoreRepositories {
  sessions: SessionRepository;
  difyConfig: DifyConfigRepository;
  plugins: PluginRepository;
  skills: SkillRepository;
  subagents: SubagentRepository;
  subagentConfig: SubagentConfigRepository;
  proactive: ProactiveRepository;
  capabilities: CapabilityStateRepository;
  knowledge: KnowledgeRepository;
  tools: ToolRepository;
  mcp: McpRepository;
}
