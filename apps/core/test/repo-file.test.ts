import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { createFileRepositories } from '../src/repo/file';

describe('file repositories', () => {
  it('persists state to disk and restores on next initialization', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cwork-repo-file-'));
    const filePath = join(root, 'repositories.json');

    const repoA = await createFileRepositories({ filePath });
    await repoA.plugins.upsert({
      pluginId: 'demo.plugin',
      name: 'Demo',
      version: '0.1.0',
      source: 'local',
      status: 'enabled',
      error: null
    });
    await repoA.proactive.upsert({
      jobId: 'job_1',
      name: 'daily',
      sessionId: 'sess_1',
      prompt: 'hello',
      cronExpression: '0 9 * * *',
      runOnce: false,
      timezone: 'UTC',
      enabled: true,
      status: 'pending',
      updatedAt: new Date().toISOString()
    });

    const repoB = await createFileRepositories({ filePath });
    const plugins = await repoB.plugins.list();
    const jobs = await repoB.proactive.list();

    expect(plugins.map((item) => item.pluginId)).toContain('demo.plugin');
    expect(jobs.map((item) => item.jobId)).toContain('job_1');

    await rm(root, { recursive: true, force: true });
  });
});
