import type { MessagePart, RuntimeChatRequestInput, RuntimeSseEvent } from '@cwork/shared';
import type { SseWriter } from '../sse/writer';
import type { SessionRecord } from '../repo/interfaces';

export interface PipelineStopSignal {
  stop: true;
  reason?: string;
}

export interface PipelineEmitSignal {
  emit: RuntimeSseEvent;
}

export type PipelineSignal = PipelineStopSignal | PipelineEmitSignal | void;

export interface RuntimePipelineContext {
  requestId: string;
  sessionId: string;
  receivedAt: string;
  request: RuntimeChatRequestInput;
  normalizedMessage: MessagePart[];
  session: SessionRecord;
  sseEvents: RuntimeSseEvent[];
  writer: SseWriter;
  state: Record<string, unknown>;
}

export type PipelineStageRunResult = PipelineSignal | AsyncGenerator<PipelineSignal, void, void>;

export interface PipelineStage {
  readonly name: string;
  run(ctx: RuntimePipelineContext): Promise<PipelineStageRunResult> | PipelineStageRunResult;
}

export interface PipelineExecutionResult {
  stopped: boolean;
  stopReason?: string;
}
