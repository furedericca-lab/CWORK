import { randomUUID } from 'node:crypto';
import type { ProactiveJob, ProactiveJobCreateRequestInput } from '@cwork/shared';
import { proactiveJobCreateRequestSchema } from '@cwork/shared';
import { AppError } from '../errors/app-error';
import { ERROR_CODE } from '../errors/error-code';
import type { ProactiveRepository } from '../repo/interfaces';
import { parseCronExpression } from './cron';

const nowIso = () => new Date().toISOString();

export class ProactiveManager {
  constructor(private readonly repository: ProactiveRepository) {}

  async listJobs(): Promise<ProactiveJob[]> {
    return this.repository.list();
  }

  async getJob(jobId: string): Promise<ProactiveJob | null> {
    return this.repository.get(jobId);
  }

  async createJob(input: unknown): Promise<ProactiveJob> {
    const parsed = proactiveJobCreateRequestSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, 'Invalid proactive job payload', parsed.error.flatten());
    }

    const normalized = this.normalizeCreateRequest(parsed.data);
    const now = nowIso();
    const job: ProactiveJob = {
      jobId: `job_${randomUUID()}`,
      name: normalized.name,
      sessionId: normalized.sessionId,
      prompt: normalized.prompt,
      ...(normalized.cronExpression ? { cronExpression: normalized.cronExpression } : {}),
      runOnce: normalized.runOnce,
      ...(normalized.runAt ? { runAt: normalized.runAt } : {}),
      ...(normalized.timezone ? { timezone: normalized.timezone } : {}),
      enabled: normalized.enabled,
      status: 'pending',
      updatedAt: now
    };

    await this.repository.upsert(job);
    return job;
  }

  async deleteJob(jobId: string): Promise<void> {
    const found = await this.repository.get(jobId);
    if (!found) {
      throw new AppError(ERROR_CODE.NOT_FOUND, `Proactive job not found: ${jobId}`);
    }
    await this.repository.delete(jobId);
  }

  async updateJobStatus(
    jobId: string,
    patch: Partial<Pick<ProactiveJob, 'status' | 'enabled' | 'lastRunAt' | 'lastError'>>
  ): Promise<ProactiveJob> {
    const found = await this.repository.get(jobId);
    if (!found) {
      throw new AppError(ERROR_CODE.NOT_FOUND, `Proactive job not found: ${jobId}`);
    }

    const next: ProactiveJob = {
      ...found,
      ...patch,
      updatedAt: nowIso()
    };

    await this.repository.upsert(next);
    return next;
  }

  private normalizeCreateRequest(input: ProactiveJobCreateRequestInput): ProactiveJobCreateRequestInput & { runOnce: boolean; enabled: boolean } {
    const runOnce = input.runOnce ?? !input.cronExpression;
    const enabled = input.enabled ?? true;

    if (input.timezone) {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: input.timezone }).format(new Date());
      } catch {
        throw new AppError(ERROR_CODE.VALIDATION_ERROR, `Invalid timezone: ${input.timezone}`);
      }
    }

    if (!runOnce && !input.cronExpression) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, 'Recurring proactive job requires cronExpression');
    }

    if (!runOnce && input.cronExpression) {
      parseCronExpression(input.cronExpression);
    }

    if (runOnce && !input.runAt) {
      return {
        ...input,
        runOnce,
        enabled,
        runAt: nowIso()
      };
    }

    return {
      ...input,
      runOnce,
      enabled,
      ...(input.cronExpression ? { timezone: input.timezone ?? 'UTC' } : {})
    };
  }
}
