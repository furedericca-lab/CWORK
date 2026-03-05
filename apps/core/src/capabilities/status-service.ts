import type { CapabilityStatusResponse } from '@cwork/shared';
import type { CoreRepositories } from '../repo/interfaces';
import { KnowledgeManager } from './knowledge/manager';
import { WebSearchAdapter } from './search/adapter';
import { SandboxAdapter } from './sandbox/adapter';

const nowIso = () => new Date().toISOString();

export class CapabilityStatusService {
  constructor(
    private readonly repositories: CoreRepositories,
    private readonly searchAdapter: WebSearchAdapter,
    private readonly knowledgeManager: KnowledgeManager,
    private readonly sandboxAdapter: SandboxAdapter
  ) {}

  async getStatus(): Promise<CapabilityStatusResponse> {
    const timestamp = nowIso();
    const [plugins, skills, mcpServers, difyOk] = await Promise.all([
      this.repositories.plugins.list(),
      this.repositories.skills.list(),
      this.repositories.mcp.list(),
      this.repositories.difyConfig
        .get()
        .then(() => true)
        .catch(() => false)
    ]);

    const mcpStates = await Promise.all(mcpServers.map((server) => this.repositories.mcp.getRuntimeState(server.name)));
    const mcpHealthy = mcpStates.every((state) => (state ? state.healthy : true));

    const searchHealth = this.searchAdapter.health();
    const knowledgeHealth = this.knowledgeManager.health();
    const sandboxHealth = this.sandboxAdapter.health();

    const status: CapabilityStatusResponse = {
      dify: {
        enabled: true,
        healthy: difyOk,
        lastCheckAt: timestamp,
        ...(difyOk ? {} : { lastError: 'dify_config_unavailable' })
      },
      plugins: {
        enabled: true,
        healthy: plugins.every((item) => item.status !== 'error'),
        lastCheckAt: timestamp,
        ...(plugins.some((item) => item.status === 'error') ? { lastError: 'plugin_error_present' } : {})
      },
      skills: {
        enabled: true,
        healthy: skills.length >= 0,
        lastCheckAt: timestamp
      },
      mcp: {
        enabled: mcpServers.length > 0,
        healthy: mcpServers.length === 0 ? true : mcpHealthy,
        lastCheckAt: timestamp,
        ...(mcpHealthy ? {} : { lastError: 'mcp_server_unhealthy' })
      },
      search: {
        enabled: searchHealth.enabled,
        healthy: searchHealth.healthy,
        lastCheckAt: timestamp
      },
      knowledge: {
        enabled: knowledgeHealth.enabled,
        healthy: knowledgeHealth.healthy,
        lastCheckAt: timestamp
      },
      sandbox: {
        enabled: sandboxHealth.enabled,
        healthy: sandboxHealth.healthy,
        lastCheckAt: timestamp,
        ...(sandboxHealth.lastError ? { lastError: sandboxHealth.lastError } : {})
      }
    };

    await this.repositories.capabilities.set(status);
    return status;
  }
}
