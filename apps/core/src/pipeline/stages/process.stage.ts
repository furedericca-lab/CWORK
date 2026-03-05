import type { CoreRepositories } from '../../repo/interfaces';
import { DifyRunner } from '../../dify/runner';
import type { PipelineSignal, PipelineStage, RuntimePipelineContext } from '../types';

export class ProcessStage implements PipelineStage {
  readonly name = 'ProcessStage';

  constructor(
    private readonly runner: DifyRunner,
    private readonly repositories: CoreRepositories
  ) {}

  async *run(ctx: RuntimePipelineContext): AsyncGenerator<PipelineSignal, void, void> {
    const result = await this.runner.run({
      requestId: ctx.requestId,
      sessionId: ctx.sessionId,
      request: ctx.request,
      messageChain: ctx.normalizedMessage,
      session: ctx.session
    });

    ctx.session = {
      ...result.nextSession,
      updatedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString()
    };
    await this.repositories.sessions.upsert(ctx.session);

    for (const sseEvent of result.events) {
      yield { emit: sseEvent };
    }
  }
}
