import type { ProactiveJob } from '@cwork/shared';
import { ProactiveManager } from './manager';

const DEFAULT_INTERVAL_SEC = 60;
const MAX_TIMEOUT_MS = 2_147_483_647;

const parseCronToMs = (expression: string): number => {
  const secMatch = expression.match(/^\*\/(\d+)\s+\*\s+\*\s+\*\s+\*\s+\*$/);
  if (secMatch) {
    return Math.max(1, Number(secMatch[1])) * 1000;
  }

  const minMatch = expression.match(/^\*\/(\d+)\s+\*\s+\*\s+\*\s+\*$/);
  if (minMatch) {
    return Math.max(1, Number(minMatch[1])) * 60 * 1000;
  }

  return DEFAULT_INTERVAL_SEC * 1000;
};

export interface ProactiveSchedulerOptions {
  onRun: (job: ProactiveJob) => Promise<void>;
  nowFn?: () => Date;
  setTimeoutFn?: (callback: () => void, ms: number) => NodeJS.Timeout;
  clearTimeoutFn?: (timer: NodeJS.Timeout) => void;
  setIntervalFn?: (callback: () => void, ms: number) => NodeJS.Timeout;
  clearIntervalFn?: (timer: NodeJS.Timeout) => void;
  logger?: {
    info(payload: Record<string, unknown>, message: string): void;
    error(payload: Record<string, unknown>, message: string): void;
  };
}

export class ProactiveScheduler {
  private readonly nowFn: () => Date;
  private readonly setTimeoutFn: (callback: () => void, ms: number) => NodeJS.Timeout;
  private readonly clearTimeoutFn: (timer: NodeJS.Timeout) => void;
  private readonly setIntervalFn: (callback: () => void, ms: number) => NodeJS.Timeout;
  private readonly clearIntervalFn: (timer: NodeJS.Timeout) => void;
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private started = false;

  constructor(
    private readonly manager: ProactiveManager,
    private readonly options: ProactiveSchedulerOptions
  ) {
    this.nowFn = options.nowFn ?? (() => new Date());
    this.setTimeoutFn = options.setTimeoutFn ?? setTimeout;
    this.clearTimeoutFn = options.clearTimeoutFn ?? clearTimeout;
    this.setIntervalFn = options.setIntervalFn ?? setInterval;
    this.clearIntervalFn = options.clearIntervalFn ?? clearInterval;
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;

    const jobs = await this.manager.listJobs();
    for (const job of jobs) {
      if (job.enabled) {
        await this.scheduleJob(job);
      }
    }
  }

  async stop(): Promise<void> {
    for (const timer of this.timers.values()) {
      this.clearTimeoutFn(timer);
      this.clearIntervalFn(timer);
    }
    this.timers.clear();
    this.started = false;
  }

  async onJobCreated(job: ProactiveJob): Promise<void> {
    if (!job.enabled) {
      return;
    }
    await this.scheduleJob(job);
  }

  onJobDeleted(jobId: string): void {
    this.unscheduleJob(jobId);
  }

  private async scheduleJob(job: ProactiveJob): Promise<void> {
    this.unscheduleJob(job.jobId);

    if (job.runOnce) {
      const targetTime = new Date(job.runAt ?? this.nowFn().toISOString()).getTime();
      const delayMs = Math.max(0, Math.min(MAX_TIMEOUT_MS, targetTime - this.nowFn().getTime()));
      const timer = this.setTimeoutFn(() => {
        void this.executeJob(job.jobId, true);
      }, delayMs);
      this.timers.set(job.jobId, timer);
      return;
    }

    const intervalMs = parseCronToMs(job.cronExpression ?? '');
    const timer = this.setIntervalFn(() => {
      void this.executeJob(job.jobId, false);
    }, intervalMs);
    this.timers.set(job.jobId, timer);
  }

  private unscheduleJob(jobId: string): void {
    const timer = this.timers.get(jobId);
    if (!timer) {
      return;
    }
    this.clearTimeoutFn(timer);
    this.clearIntervalFn(timer);
    this.timers.delete(jobId);
  }

  private async executeJob(jobId: string, runOnce: boolean): Promise<void> {
    const job = await this.manager.getJob(jobId);
    if (!job || !job.enabled) {
      this.unscheduleJob(jobId);
      return;
    }

    await this.manager.updateJobStatus(jobId, { status: 'running', lastError: undefined });

    try {
      await this.options.onRun(job);

      await this.manager.updateJobStatus(jobId, {
        status: 'succeeded',
        lastRunAt: this.nowFn().toISOString(),
        ...(runOnce ? { enabled: false } : {})
      });
      this.options.logger?.info({ jobId }, 'proactive_job_succeeded');
    } catch (error) {
      await this.manager.updateJobStatus(jobId, {
        status: 'failed',
        lastError: error instanceof Error ? error.message : String(error)
      });
      this.options.logger?.error(
        {
          jobId,
          error: error instanceof Error ? error.message : String(error)
        },
        'proactive_job_failed'
      );
    } finally {
      if (runOnce) {
        this.unscheduleJob(jobId);
      }
    }
  }
}
