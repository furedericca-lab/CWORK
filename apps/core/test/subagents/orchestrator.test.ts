import { describe, expect, it } from 'vitest';
import { createInMemoryRepositories } from '../../src/repo/memory';
import { ToolRegistry } from '../../src/tools/registry';
import { SubagentOrchestrator } from '../../src/subagents/orchestrator';

describe('SubagentOrchestrator', () => {
  it('normalizes config, registers handoff tools, and resolves handoff', async () => {
    const repositories = createInMemoryRepositories();
    const toolRegistry = new ToolRegistry(repositories.tools);
    const orchestrator = new SubagentOrchestrator(repositories.subagents, repositories.subagentConfig, toolRegistry);

    await orchestrator.initialize();
    const updated = await orchestrator.updateConfig({
      enable: true,
      removeMainDuplicateTools: false,
      agents: [
        {
          subagentId: 'research',
          name: 'Research',
          enabled: true,
          tools: ['web.search']
        }
      ]
    });

    expect(updated.mainEnable).toBe(true);
    expect(updated.agents).toHaveLength(1);

    const tools = await toolRegistry.list();
    expect(tools.map((item) => item.toolName)).toContain('handoff.research');

    const request = {
      sessionId: 'sess_1',
      message: 'hello',
      enableStreaming: true,
      metadata: { subagentId: 'research' }
    };
    const handoff = await orchestrator.resolveHandoff(request, [{ type: 'plain', text: 'hello' }]);
    expect(handoff).toMatchObject({ from: 'main', to: 'research' });

    if (!handoff) {
      throw new Error('handoff expected');
    }
    orchestrator.applyHandoffContext(request, handoff);
    const metadata = request.metadata as Record<string, unknown>;
    expect(metadata.handoffDepth).toBe(1);
  });
});
