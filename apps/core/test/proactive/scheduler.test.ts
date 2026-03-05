import { describe, expect, it } from 'vitest';
import { createInMemoryRepositories } from '../../src/repo/memory';
import { ProactiveManager } from '../../src/proactive/manager';
import { ProactiveScheduler } from '../../src/proactive/scheduler';

describe('ProactiveScheduler', () => {
  it('restores jobs on startup and triggers run callback', async () => {
    const repositories = createInMemoryRepositories();
    const manager = new ProactiveManager(repositories.proactive);

    const created = await manager.createJob({
      name: 'job',
      sessionId: 'sess_1',
      prompt: 'hello',
      runAt: new Date().toISOString()
    });

    let runCount = 0;
    const timeoutTimers: NodeJS.Timeout[] = [];
    const scheduler = new ProactiveScheduler(manager, {
      onRun: async () => {
        runCount += 1;
      },
      setTimeoutFn: (callback) => {
        callback();
        const timer = setTimeout(() => undefined, 0);
        timeoutTimers.push(timer);
        return timer;
      },
      clearTimeoutFn: (timer) => clearTimeout(timer),
      setIntervalFn: (callback) => {
        callback();
        const timer = setInterval(() => undefined, 10_000);
        return timer;
      },
      clearIntervalFn: (timer) => clearInterval(timer)
    });

    await scheduler.start();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const stored = await manager.getJob(created.jobId);
    expect(runCount).toBe(1);
    expect(stored?.status).toBe('succeeded');
    expect(stored?.enabled).toBe(false);

    await scheduler.stop();
    timeoutTimers.forEach((timer) => clearTimeout(timer));
  });

  it('skips duplicate concurrent trigger for the same recurring job', async () => {
    const repositories = createInMemoryRepositories();
    const manager = new ProactiveManager(repositories.proactive);
    await manager.createJob({
      name: 'job-recurring',
      sessionId: 'sess_1',
      prompt: 'hello',
      cronExpression: '*/1 * * * * *'
    });

    let runCount = 0;
    let resolveRun: (() => void) | undefined;
    const onRunGate = new Promise<void>((resolve) => {
      resolveRun = resolve;
    });

    const scheduler = new ProactiveScheduler(manager, {
      onRun: async () => {
        runCount += 1;
        await onRunGate;
      },
      setIntervalFn: (callback) => {
        callback();
        callback();
        return setInterval(() => undefined, 10_000);
      },
      clearIntervalFn: (timer) => clearInterval(timer),
      setTimeoutFn: (callback) => setTimeout(callback, 0),
      clearTimeoutFn: (timer) => clearTimeout(timer)
    });

    await scheduler.start();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(runCount).toBe(1);

    if (resolveRun) {
      resolveRun();
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
    await scheduler.stop();
  });
});
