import { describe, expect, it } from 'vitest';
import { createInMemoryRepositories } from '../../src/repo/memory';
import { ProactiveManager } from '../../src/proactive/manager';

describe('ProactiveManager', () => {
  it('creates and updates proactive jobs with validation', async () => {
    const repositories = createInMemoryRepositories();
    const manager = new ProactiveManager(repositories.proactive);

    await expect(
      manager.createJob({
        name: 'bad',
        sessionId: 'sess_1',
        prompt: 'hello'
      })
    ).rejects.toThrow(/Invalid proactive job payload/);

    const recurring = await manager.createJob({
      name: 'cron-job',
      sessionId: 'sess_1',
      prompt: 'do cron',
      cronExpression: '*/5 * * * * *'
    });
    expect(recurring.runOnce).toBe(false);
    expect(recurring.timezone).toBe('UTC');

    await expect(
      manager.createJob({
        name: 'tz-bad',
        sessionId: 'sess_1',
        prompt: 'do cron',
        cronExpression: '*/5 * * * * *',
        timezone: 'Mars/Phobos'
      })
    ).rejects.toThrow(/Invalid timezone/);

    await expect(
      manager.createJob({
        name: 'cron-bad',
        sessionId: 'sess_1',
        prompt: 'do cron',
        cronExpression: '0 9 * *'
      })
    ).rejects.toThrow(/Expected 5 or 6 fields/);

    const oneShot = await manager.createJob({
      name: 'one-shot',
      sessionId: 'sess_2',
      prompt: 'do once',
      runAt: new Date(Date.now() + 1000).toISOString()
    });
    expect(oneShot.runOnce).toBe(true);

    const updated = await manager.updateJobStatus(oneShot.jobId, { status: 'running' });
    expect(updated.status).toBe('running');

    await manager.deleteJob(oneShot.jobId);
    expect(await manager.getJob(oneShot.jobId)).toBeNull();
  });
});
