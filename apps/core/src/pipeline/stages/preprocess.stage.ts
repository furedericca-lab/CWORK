import { AppError } from '../../errors/app-error';
import { ERROR_CODE } from '../../errors/error-code';
import { normalizeMessageInput } from '../../message/chain';
import type { PipelineStage, PipelineStageRunResult, RuntimePipelineContext } from '../types';

export class PreprocessStage implements PipelineStage {
  readonly name = 'PreprocessStage';

  async run(ctx: RuntimePipelineContext): Promise<PipelineStageRunResult> {
    const normalized = normalizeMessageInput(ctx.request.message);
    if (normalized.length === 0) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, 'Message cannot be empty');
    }

    ctx.normalizedMessage = normalized;
    return;
  }
}
