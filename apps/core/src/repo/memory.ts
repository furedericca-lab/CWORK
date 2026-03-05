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

export const defaultDifyConfig: DifyConfig = {
  providerId: 'dify_app_default',
  difyApiKey: 'dev-dify-key',
  difyApiBase: 'https://api.dify.ai/v1',
  difyApiType: 'chat',
  difyWorkflowOutputKey: 'astrbot_wf_output',
  difyQueryInputKey: 'astrbot_text_query',
  timeoutSec: 30,
  variables: {}
};

export const defaultSubagentConfig: SubagentConfig = {
  mainEnable: true,
  removeMainDuplicateTools: false,
  routerSystemPrompt: 'Route to a specialized subagent when needed.',
  agents: []
};

export const defaultCapabilities: CapabilityStatusResponse = {
  dify: { enabled: true, healthy: true },
  plugins: { enabled: true, healthy: true },
  skills: { enabled: true, healthy: true },
  mcp: { enabled: true, healthy: true },
  search: { enabled: true, healthy: true },
  knowledge: { enabled: true, healthy: true },
  sandbox: { enabled: false, healthy: true }
};

export const createInMemoryRepositories = (): CoreRepositories => {
  const sessionStore = new Map<string, SessionRecord>();
  const pluginStore = new Map<string, PluginItem>();
  const skillStore = new Map<string, SkillDescriptor>();
  const subagentStore = new Map<string, SubagentDescriptor>();
  const proactiveStore = new Map<string, ProactiveJobRecord>();
  const toolStore = new Map<string, ToolItem>();
  const mcpStore = new Map<string, McpServerConfig>();
  const mcpRuntimeStore = new Map<string, McpServerRuntimeState>();
  const knowledgeDocStore = new Map<string, KnowledgeDocument>();
  const knowledgeTaskStore = new Map<string, KnowledgeTaskStatus>();
  let difyConfig = structuredClone(defaultDifyConfig);
  let subagentConfig = structuredClone(defaultSubagentConfig);
  let capabilities = structuredClone(defaultCapabilities);

  return {
    sessions: {
      async list(page, pageSize) {
        const allItems = Array.from(sessionStore.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        const offset = Math.max(0, (page - 1) * pageSize);
        return {
          items: allItems.slice(offset, offset + pageSize),
          total: allItems.length
        };
      },
      async findById(sessionId) {
        return sessionStore.get(sessionId) ?? null;
      },
      async upsert(session) {
        sessionStore.set(session.sessionId, session);
      }
    },
    difyConfig: {
      async get() {
        return structuredClone(difyConfig);
      },
      async set(nextConfig) {
        difyConfig = structuredClone(nextConfig);
        return structuredClone(difyConfig);
      }
    },
    plugins: {
      async list() {
        return Array.from(pluginStore.values());
      },
      async get(pluginId) {
        return pluginStore.get(pluginId) ?? null;
      },
      async upsert(item) {
        pluginStore.set(item.pluginId, item);
      },
      async delete(pluginId) {
        pluginStore.delete(pluginId);
      }
    },
    skills: {
      async list() {
        return Array.from(skillStore.values());
      },
      async get(skillId) {
        return skillStore.get(skillId) ?? null;
      },
      async upsert(item) {
        skillStore.set(item.skillId, item);
      },
      async delete(skillId) {
        skillStore.delete(skillId);
      }
    },
    subagents: {
      async list() {
        return Array.from(subagentStore.values());
      },
      async get(subagentId) {
        return subagentStore.get(subagentId) ?? null;
      },
      async upsert(item) {
        subagentStore.set(item.subagentId, item);
      },
      async delete(subagentId) {
        subagentStore.delete(subagentId);
      }
    },
    subagentConfig: {
      async get() {
        return structuredClone(subagentConfig);
      },
      async set(nextConfig) {
        subagentConfig = structuredClone(nextConfig);
        return structuredClone(subagentConfig);
      }
    },
    proactive: {
      async list() {
        return Array.from(proactiveStore.values());
      },
      async get(jobId) {
        return proactiveStore.get(jobId) ?? null;
      },
      async upsert(item) {
        proactiveStore.set(item.jobId, item);
      },
      async delete(jobId) {
        proactiveStore.delete(jobId);
      }
    },
    capabilities: {
      async get() {
        return structuredClone(capabilities);
      },
      async set(next) {
        capabilities = structuredClone(next);
        return structuredClone(capabilities);
      }
    },
    knowledge: {
      async listDocuments() {
        return Array.from(knowledgeDocStore.values());
      },
      async getDocument(docId) {
        return knowledgeDocStore.get(docId) ?? null;
      },
      async upsertDocument(doc) {
        knowledgeDocStore.set(doc.docId, doc);
      },
      async deleteDocument(docId) {
        knowledgeDocStore.delete(docId);
      },
      async listTasks() {
        return Array.from(knowledgeTaskStore.values());
      },
      async getTask(taskId) {
        return knowledgeTaskStore.get(taskId) ?? null;
      },
      async upsertTask(task) {
        knowledgeTaskStore.set(task.taskId, task);
      }
    },
    tools: {
      async list() {
        return Array.from(toolStore.values());
      },
      async get(toolName) {
        return toolStore.get(toolName) ?? null;
      },
      async upsert(item) {
        toolStore.set(item.toolName, item);
      },
      async delete(toolName) {
        toolStore.delete(toolName);
      }
    },
    mcp: {
      async list() {
        return Array.from(mcpStore.values());
      },
      async get(name) {
        return mcpStore.get(name) ?? null;
      },
      async upsert(item) {
        mcpStore.set(item.name, item);
      },
      async delete(name) {
        mcpStore.delete(name);
        mcpRuntimeStore.delete(name);
      },
      async setRuntimeState(name, state) {
        mcpRuntimeStore.set(name, state);
      },
      async getRuntimeState(name) {
        return mcpRuntimeStore.get(name) ?? null;
      }
    }
  };
};
