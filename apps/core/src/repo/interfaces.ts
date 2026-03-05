import type {
  DifyConfig,
  McpServerConfig,
  McpServerRuntimeState,
  PluginItem,
  RuntimeSessionItem,
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
  upsert(item: SubagentDescriptor): Promise<void>;
}

export interface ProactiveJobRecord {
  jobId: string;
  cron: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  updatedAt: string;
}

export interface ProactiveRepository {
  list(): Promise<ProactiveJobRecord[]>;
  upsert(item: ProactiveJobRecord): Promise<void>;
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
  proactive: ProactiveRepository;
  tools: ToolRepository;
  mcp: McpRepository;
}
