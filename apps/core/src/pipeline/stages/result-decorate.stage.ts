import type { RuntimeChatFinalResultEvent } from '@cwork/shared';
import type { PipelineStage, PipelineStageRunResult, RuntimePipelineContext } from '../types';

const fallbackFinal: RuntimeChatFinalResultEvent = {
  resultType: 'agent_runner_error',
  messageChain: [{ type: 'plain', text: 'No final result from runtime pipeline.' }]
};

export class ResultDecorateStage implements PipelineStage {
  readonly name = 'ResultDecorateStage';

  async run(ctx: RuntimePipelineContext): Promise<PipelineStageRunResult> {
    const hasFinalResult = ctx.sseEvents.some((event) => event.event === 'final_result');
    if (!hasFinalResult) {
      ctx.sseEvents.push({ event: 'final_result', data: fallbackFinal });
    }

    return;
  }
}
