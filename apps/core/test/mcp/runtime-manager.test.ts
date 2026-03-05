import { describe, expect, it } from 'vitest';
import { McpRuntimeManager } from '../../src/mcp/runtime-manager';
import { createInMemoryRepositories } from '../../src/repo/memory';

describe('McpRuntimeManager', () => {
  it('supports add/update/delete/test with validation and state', async () => {
    const repositories = createInMemoryRepositories();
    const manager = new McpRuntimeManager(repositories.mcp);

    await manager.addServer({
      name: 'server1',
      enabled: true,
      transport: 'stdio',
      command: 'node',
      timeoutSec: 5
    });

    expect((await manager.listServers()).map((item) => item.name)).toContain('server1');

    await manager.updateServer({
      name: 'server1',
      enabled: true,
      transport: 'http',
      url: 'https://example.com',
      timeoutSec: 5
    });

    const state = await manager.testServer('server1');
    expect(state.name).toBe('server1');
    expect(typeof state.healthy).toBe('boolean');

    await manager.disableServer('server1');
    await manager.disableServer('server1');
    await manager.enableServer('server1');
    await manager.enableServer('server1');

    const listed = await manager.listServers();
    expect(listed.find((item) => item.name === 'server1')?.runtime.enabled).toBe(true);

    await manager.deleteServer('server1');
    expect(await manager.listServers()).toHaveLength(0);
  });
});
