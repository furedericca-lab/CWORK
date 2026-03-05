import { describe, expect, it } from 'vitest';
import { CapabilityStatusService } from '../../src/capabilities/status-service';
import { KnowledgeManager } from '../../src/capabilities/knowledge/manager';
import { WebSearchAdapter } from '../../src/capabilities/search/adapter';
import { SandboxAdapter } from '../../src/capabilities/sandbox/adapter';
import { createInMemoryRepositories } from '../../src/repo/memory';

describe('CapabilityStatusService', () => {
  it('aggregates capability states from repositories and adapters', async () => {
    const repositories = createInMemoryRepositories();
    await repositories.plugins.upsert({
      pluginId: 'plugin.error',
      name: 'Plugin Error',
      version: '0.1.0',
      source: 'local',
      status: 'error',
      error: 'boom'
    });
    await repositories.mcp.upsert({
      name: 'mcp1',
      enabled: true,
      transport: 'stdio',
      command: 'node',
      timeoutSec: 10
    });
    await repositories.mcp.setRuntimeState('mcp1', {
      name: 'mcp1',
      enabled: true,
      healthy: false,
      lastError: 'down'
    });

    const service = new CapabilityStatusService(
      repositories,
      new WebSearchAdapter('tavily'),
      new KnowledgeManager(repositories.knowledge),
      new SandboxAdapter({ mode: 'sandbox' })
    );

    const status = await service.getStatus();
    expect(status.plugins.healthy).toBe(false);
    expect(status.mcp.healthy).toBe(false);
    expect(status.search.enabled).toBe(true);
    expect(status.sandbox.enabled).toBe(true);
  });
});
