import { describe, expect, it } from 'vitest';
import { createInMemoryRepositories } from '../src/repo/memory';

describe('in-memory repositories', () => {
  it('stores and paginates sessions', async () => {
    const repo = createInMemoryRepositories();

    await repo.sessions.upsert({
      sessionId: 'sess_1',
      displayName: 'alpha',
      createdAt: '2026-03-05T00:00:00.000Z',
      updatedAt: '2026-03-05T00:00:00.000Z',
      lastActivityAt: '2026-03-05T00:00:00.000Z',
      sessionVariables: {}
    });

    await repo.sessions.upsert({
      sessionId: 'sess_2',
      displayName: 'beta',
      createdAt: '2026-03-05T00:01:00.000Z',
      updatedAt: '2026-03-05T00:01:00.000Z',
      lastActivityAt: '2026-03-05T00:01:00.000Z',
      sessionVariables: {}
    });

    const firstPage = await repo.sessions.list(1, 1);
    const secondPage = await repo.sessions.list(2, 1);

    expect(firstPage.total).toBe(2);
    expect(firstPage.items[0]?.sessionId).toBe('sess_2');
    expect(secondPage.items[0]?.sessionId).toBe('sess_1');
  });

  it('stores config, plugin, skill, subagent and proactive entities', async () => {
    const repo = createInMemoryRepositories();

    await repo.difyConfig.set({
      providerId: 'default',
      difyApiKey: '${DIFY_API_KEY}',
      difyApiBase: 'https://api.dify.ai/v1',
      difyApiType: 'chat',
      difyWorkflowOutputKey: 'wf_output',
      difyQueryInputKey: 'query',
      timeoutSec: 30,
      variables: {}
    });
    await repo.plugins.upsert({
      pluginId: 'plugin.hello',
      name: 'Hello Plugin',
      version: '0.1.0',
      source: 'local',
      status: 'enabled',
      error: null
    });
    await repo.skills.upsert({
      skillId: 'skill.search',
      name: 'Search',
      enabled: true
    });
    await repo.subagents.upsert({
      subagentId: 'research',
      name: 'Research',
      enabled: true,
      tools: ['web.search']
    });
    await repo.proactive.upsert({
      jobId: 'job_daily',
      cron: '0 8 * * *',
      status: 'pending',
      updatedAt: '2026-03-05T00:00:00.000Z'
    });

    const config = await repo.difyConfig.get();
    const plugins = await repo.plugins.list();
    const skills = await repo.skills.list();
    const subagents = await repo.subagents.list();
    const jobs = await repo.proactive.list();

    expect(config.providerId).toBe('default');
    expect(plugins).toHaveLength(1);
    expect(skills).toHaveLength(1);
    expect(subagents).toHaveLength(1);
    expect(jobs).toHaveLength(1);
  });
});
