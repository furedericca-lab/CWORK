import type { PipelineStage, PipelineStageRunResult } from '../types';

export class WakeCheckStage implements PipelineStage {
  readonly name = 'WakeCheckStage';

  async run(): Promise<PipelineStageRunResult> {
    return;
  }
}
