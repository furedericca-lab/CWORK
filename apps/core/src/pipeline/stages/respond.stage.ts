import type { PipelineStage, PipelineStageRunResult, RuntimePipelineContext } from '../types';

export class RespondStage implements PipelineStage {
  readonly name = 'RespondStage';

  async run(ctx: RuntimePipelineContext): Promise<PipelineStageRunResult> {
    ctx.writer.startHeartbeat();
    ctx.writer.writeEvent('meta', {
      requestId: ctx.requestId,
      sessionId: ctx.sessionId,
      timestamp: ctx.receivedAt
    });

    let hasError = false;
    for (const event of ctx.sseEvents) {
      ctx.writer.writeRuntimeEvent(event);
      if (event.event === 'error') {
        hasError = true;
      }
    }

    if (hasError) {
      ctx.writer.close();
      return { stop: true, reason: 'error_event_emitted' };
    }

    ctx.writer.closeWithDone();
    return { stop: true, reason: 'completed' };
  }
}
