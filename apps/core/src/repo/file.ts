import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type {
  CapabilityStatusResponse,
  DifyConfig,
  KnowledgeDocument,
  KnowledgeTaskStatus,
  McpServerConfig,
  McpServerRuntimeState,
  PluginItem,
  SkillDescriptor,
  SubagentConfig,
  SubagentDescriptor,
  ToolItem
} from '@cwork/shared';
import type { CoreRepositories, ProactiveJobRecord, SessionRecord } from './interfaces';
import { createInMemoryRepositories, defaultCapabilities, defaultDifyConfig, defaultSubagentConfig } from './memory';

interface PersistedState {
  version: 1;
  sessions: SessionRecord[];
  difyConfig: DifyConfig;
  plugins: PluginItem[];
  skills: SkillDescriptor[];
  subagents: SubagentDescriptor[];
  subagentConfig: SubagentConfig;
  proactive: ProactiveJobRecord[];
  capabilities: CapabilityStatusResponse;
  knowledgeDocuments: KnowledgeDocument[];
  knowledgeTasks: KnowledgeTaskStatus[];
  tools: ToolItem[];
  mcp: McpServerConfig[];
  mcpRuntime: McpServerRuntimeState[];
}

export interface FileRepositoryOptions {
  filePath?: string;
}

const defaultState = (): PersistedState => ({
  version: 1,
  sessions: [],
  difyConfig: structuredClone(defaultDifyConfig),
  plugins: [],
  skills: [],
  subagents: [],
  subagentConfig: structuredClone(defaultSubagentConfig),
  proactive: [],
  capabilities: structuredClone(defaultCapabilities),
  knowledgeDocuments: [],
  knowledgeTasks: [],
  tools: [],
  mcp: [],
  mcpRuntime: []
});

const parsePersistedState = (raw: string): PersistedState => {
  const parsed = JSON.parse(raw) as Partial<PersistedState>;
  return {
    ...defaultState(),
    ...parsed,
    version: 1
  };
};

const snapshotFromRepositories = async (repositories: CoreRepositories): Promise<PersistedState> => {
  const [sessions, difyConfig, plugins, skills, subagents, subagentConfig, proactive, capabilities, knowledgeDocuments, knowledgeTasks, tools, mcp] =
    await Promise.all([
      repositories.sessions.list(1, Number.MAX_SAFE_INTEGER).then((result) => result.items),
      repositories.difyConfig.get(),
      repositories.plugins.list(),
      repositories.skills.list(),
      repositories.subagents.list(),
      repositories.subagentConfig.get(),
      repositories.proactive.list(),
      repositories.capabilities.get(),
      repositories.knowledge.listDocuments(),
      repositories.knowledge.listTasks(),
      repositories.tools.list(),
      repositories.mcp.list()
    ]);

  const mcpRuntime = await Promise.all(
    mcp.map(async (server) => (await repositories.mcp.getRuntimeState(server.name)) ?? { name: server.name, enabled: server.enabled, healthy: false })
  );

  return {
    version: 1,
    sessions,
    difyConfig,
    plugins,
    skills,
    subagents,
    subagentConfig,
    proactive,
    capabilities,
    knowledgeDocuments,
    knowledgeTasks,
    tools,
    mcp,
    mcpRuntime
  };
};

const hydrateRepositories = async (repositories: CoreRepositories, state: PersistedState): Promise<void> => {
  await Promise.all(state.sessions.map((item) => repositories.sessions.upsert(item)));
  await repositories.difyConfig.set(state.difyConfig);
  await Promise.all(state.plugins.map((item) => repositories.plugins.upsert(item)));
  await Promise.all(state.skills.map((item) => repositories.skills.upsert(item)));
  await Promise.all(state.subagents.map((item) => repositories.subagents.upsert(item)));
  await repositories.subagentConfig.set(state.subagentConfig);
  await Promise.all(state.proactive.map((item) => repositories.proactive.upsert(item)));
  await repositories.capabilities.set(state.capabilities);
  await Promise.all(state.knowledgeDocuments.map((item) => repositories.knowledge.upsertDocument(item)));
  await Promise.all(state.knowledgeTasks.map((item) => repositories.knowledge.upsertTask(item)));
  await Promise.all(state.tools.map((item) => repositories.tools.upsert(item)));
  await Promise.all(state.mcp.map((item) => repositories.mcp.upsert(item)));
  await Promise.all(state.mcpRuntime.map((item) => repositories.mcp.setRuntimeState(item.name, item)));
};

export const createFileRepositories = async (options: FileRepositoryOptions = {}): Promise<CoreRepositories> => {
  const filePath = options.filePath ? resolve(options.filePath) : resolve(process.cwd(), '.runtime/state/repositories.json');
  const repositories = createInMemoryRepositories();
  let writeQueue = Promise.resolve();

  await mkdir(dirname(filePath), { recursive: true });

  try {
    const raw = await readFile(filePath, 'utf8');
    await hydrateRepositories(repositories, parsePersistedState(raw));
  } catch {
    // First startup or unreadable persisted file: continue with defaults.
  }

  const persist = async (): Promise<void> => {
    const state = await snapshotFromRepositories(repositories);
    const tempPath = `${filePath}.tmp`;
    await writeFile(tempPath, JSON.stringify(state, null, 2), 'utf8');
    await rename(tempPath, filePath);
  };

  const persistQueued = async (): Promise<void> => {
    writeQueue = writeQueue.then(persist);
    await writeQueue;
  };

  const wrap = <T extends (...args: never[]) => Promise<unknown>>(fn: T): T => {
    return (async (...args: Parameters<T>) => {
      const result = await fn(...args);
      await persistQueued();
      return result;
    }) as T;
  };

  repositories.sessions.upsert = wrap(repositories.sessions.upsert);
  repositories.difyConfig.set = wrap(repositories.difyConfig.set);
  repositories.plugins.upsert = wrap(repositories.plugins.upsert);
  repositories.plugins.delete = wrap(repositories.plugins.delete);
  repositories.skills.upsert = wrap(repositories.skills.upsert);
  repositories.skills.delete = wrap(repositories.skills.delete);
  repositories.subagents.upsert = wrap(repositories.subagents.upsert);
  repositories.subagents.delete = wrap(repositories.subagents.delete);
  repositories.subagentConfig.set = wrap(repositories.subagentConfig.set);
  repositories.proactive.upsert = wrap(repositories.proactive.upsert);
  repositories.proactive.delete = wrap(repositories.proactive.delete);
  repositories.capabilities.set = wrap(repositories.capabilities.set);
  repositories.knowledge.upsertDocument = wrap(repositories.knowledge.upsertDocument);
  repositories.knowledge.deleteDocument = wrap(repositories.knowledge.deleteDocument);
  repositories.knowledge.upsertTask = wrap(repositories.knowledge.upsertTask);
  repositories.tools.upsert = wrap(repositories.tools.upsert);
  repositories.tools.delete = wrap(repositories.tools.delete);
  repositories.mcp.upsert = wrap(repositories.mcp.upsert);
  repositories.mcp.delete = wrap(repositories.mcp.delete);
  repositories.mcp.setRuntimeState = wrap(repositories.mcp.setRuntimeState);

  await persistQueued();
  return repositories;
};
