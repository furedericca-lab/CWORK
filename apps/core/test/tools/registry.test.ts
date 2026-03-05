import { describe, expect, it } from 'vitest';
import { createInMemoryRepositories } from '../../src/repo/memory';
import { ToolRegistry } from '../../src/tools/registry';

describe('ToolRegistry', () => {
  it('supports register/list/get/toggle/remove with persisted state', async () => {
    const repositories = createInMemoryRepositories();
    const registry = new ToolRegistry(repositories.tools);

    await registry.register({
      meta: {
        toolName: 'tool.echo',
        description: 'echo',
        enabled: true,
        schema: {
          text: { type: 'string', required: true }
        },
        source: 'builtin'
      },
      handler(args) {
        return args;
      }
    });

    expect(await registry.list()).toHaveLength(1);
    expect(await registry.get('tool.echo')).toBeTruthy();

    const disabled = await registry.toggle('tool.echo', false);
    expect(disabled.enabled).toBe(false);

    await registry.remove('tool.echo');
    expect(await registry.list()).toHaveLength(0);

    await expect(registry.remove('tool.echo')).rejects.toThrow(/Tool not found/);
  });
});
