import type { PipelineEmitSignal, PipelineExecutionResult, PipelineSignal, PipelineStage, RuntimePipelineContext } from './types';

const isAsyncGenerator = <T>(value: unknown): value is AsyncGenerator<T, void, void> => {
  return typeof value === 'object' && value !== null && Symbol.asyncIterator in value;
};

const isEmitSignal = (signal: PipelineSignal): signal is PipelineEmitSignal => {
  return !!signal && typeof signal === 'object' && 'emit' in signal;
};

export class RuntimePipelineScheduler {
  private readonly stages: PipelineStage[] = [];

  register(stage: PipelineStage): this {
    this.stages.push(stage);
    return this;
  }

  registerMany(stages: PipelineStage[]): this {
    for (const stage of stages) {
      this.register(stage);
    }
    return this;
  }

  getStageNames(): string[] {
    return this.stages.map((stage) => stage.name);
  }

  async execute(ctx: RuntimePipelineContext): Promise<PipelineExecutionResult> {
    for (const stage of this.stages) {
      const result = await stage.run(ctx);

      if (isAsyncGenerator<PipelineSignal>(result)) {
        for await (const signal of result) {
          const handled = this.applySignal(ctx, signal);
          if (handled.stopped) {
            return handled;
          }
        }
        continue;
      }

      const handled = this.applySignal(ctx, result);
      if (handled.stopped) {
        return handled;
      }
    }

    return { stopped: false };
  }

  private applySignal(ctx: RuntimePipelineContext, signal: PipelineSignal): PipelineExecutionResult {
    if (!signal) {
      return { stopped: false };
    }

    if (isEmitSignal(signal)) {
      ctx.sseEvents.push(signal.emit);
      return { stopped: false };
    }

    if (signal.stop) {
      return {
        stopped: true,
        ...(signal.reason ? { stopReason: signal.reason } : {})
      };
    }

    return { stopped: false };
  }
}
