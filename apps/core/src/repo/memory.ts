import type { DifyConfig, PluginItem, SkillDescriptor, SubagentDescriptor } from '@cwork/shared';
import type { CoreRepositories, ProactiveJobRecord, SessionRecord } from './interfaces';

const defaultDifyConfig: DifyConfig = {
  providerId: 'dify_app_default',
  difyApiBase: 'https://api.dify.ai/v1',
  difyApiType: 'chat',
  difyWorkflowOutputKey: 'astrbot_wf_output',
  difyQueryInputKey: 'astrbot_text_query',
  timeoutSec: 30,
  variables: {}
};

export const createInMemoryRepositories = (): CoreRepositories => {
  const sessionStore = new Map<string, SessionRecord>();
  const pluginStore = new Map<string, PluginItem>();
  const skillStore = new Map<string, SkillDescriptor>();
  const subagentStore = new Map<string, SubagentDescriptor>();
  const proactiveStore = new Map<string, ProactiveJobRecord>();
  let difyConfig = structuredClone(defaultDifyConfig);

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
      async upsert(item) {
        pluginStore.set(item.pluginId, item);
      }
    },
    skills: {
      async list() {
        return Array.from(skillStore.values());
      },
      async upsert(item) {
        skillStore.set(item.skillId, item);
      }
    },
    subagents: {
      async list() {
        return Array.from(subagentStore.values());
      },
      async upsert(item) {
        subagentStore.set(item.subagentId, item);
      }
    },
    proactive: {
      async list() {
        return Array.from(proactiveStore.values());
      },
      async upsert(item) {
        proactiveStore.set(item.jobId, item);
      }
    }
  };
};
