import type { DifyConfig, PluginItem, RuntimeSessionItem, SkillDescriptor, SubagentDescriptor } from '@cwork/shared';

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
  upsert(item: PluginItem): Promise<void>;
}

export interface SkillRepository {
  list(): Promise<SkillDescriptor[]>;
  upsert(item: SkillDescriptor): Promise<void>;
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

export interface CoreRepositories {
  sessions: SessionRepository;
  difyConfig: DifyConfigRepository;
  plugins: PluginRepository;
  skills: SkillRepository;
  subagents: SubagentRepository;
  proactive: ProactiveRepository;
}
