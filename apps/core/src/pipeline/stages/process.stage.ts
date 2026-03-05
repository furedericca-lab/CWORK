import type { CoreRepositories } from '../../repo/interfaces';
import type { ToolExecutor } from '../../tools/executor';
import { DifyRunner } from '../../dify/runner';
import type { PipelineSignal, PipelineStage, RuntimePipelineContext } from '../types';

export class ProcessStage implements PipelineStage {
  readonly name = 'ProcessStage';

  constructor(
    private readonly runner: DifyRunner,
    private readonly repositories: CoreRepositories
  ) {}

  async *run(ctx: RuntimePipelineContext): AsyncGenerator<PipelineSignal, void, void> {
    const toolExecutor = (ctx.state.toolExecutor as ToolExecutor | undefined) ?? undefined;
    const toolCallRaw = ctx.request.metadata?.toolCall;
    const hasToolCall = typeof toolCallRaw === 'object' && toolCallRaw !== null;

    if (toolExecutor && hasToolCall) {
      const toolCall = toolCallRaw as { toolName?: unknown; arguments?: unknown };
      const toolName = typeof toolCall.toolName === 'string' ? toolCall.toolName : '';
      const args =
        typeof toolCall.arguments === 'object' && toolCall.arguments !== null && !Array.isArray(toolCall.arguments)
          ? (toolCall.arguments as Record<string, unknown>)
          : {};

      if (toolName) {
        const trace: PipelineSignal[] = [];
        const result = await toolExecutor.execute(
          toolName,
          args,
          { requestId: ctx.requestId, sessionId: ctx.sessionId },
          {
            onStart: (payload) => {
              trace.push({ emit: { event: 'tool_call_start', data: payload } });
            },
            onEnd: (payload) => {
              trace.push({ emit: { event: 'tool_call_end', data: payload } });
            }
          }
        );

        for (const signal of trace) {
          yield signal;
        }

        if (result.ok) {
          ctx.state.toolOutput = result.output;
        }
      }
    }

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
