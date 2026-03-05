import type { CoreRepositories } from '../../repo/interfaces';
import type { SubagentOrchestrator } from '../../subagents/orchestrator';
import type { ToolExecutor } from '../../tools/executor';
import { DifyRunner } from '../../dify/runner';
import type { PipelineSignal, PipelineStage, RuntimePipelineContext } from '../types';

const toCapabilityType = (toolName: string): 'knowledge' | 'search' | 'mcp' | 'sandbox' | null => {
  if (toolName.startsWith('mcp.')) {
    return 'mcp';
  }
  if (toolName.startsWith('web.search')) {
    return 'search';
  }
  if (toolName.startsWith('kb.')) {
    return 'knowledge';
  }
  if (toolName.startsWith('sandbox.')) {
    return 'sandbox';
  }
  return null;
};

export class ProcessStage implements PipelineStage {
  readonly name = 'ProcessStage';

  constructor(
    private readonly runner: DifyRunner,
    private readonly repositories: CoreRepositories
  ) {}

  async *run(ctx: RuntimePipelineContext): AsyncGenerator<PipelineSignal, void, void> {
    const toolExecutor = (ctx.state.toolExecutor as ToolExecutor | undefined) ?? undefined;
    const subagentOrchestrator = (ctx.state.subagentOrchestrator as SubagentOrchestrator | undefined) ?? undefined;

    if (subagentOrchestrator) {
      const handoff = await subagentOrchestrator.resolveHandoff(ctx.request, ctx.normalizedMessage);
      if (handoff) {
        subagentOrchestrator.applyHandoffContext(ctx.request, handoff);
        yield {
          emit: {
            event: 'handoff',
            data: handoff
          }
        };
      }
    }

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
        const capabilityType = toCapabilityType(toolName);
        const result = await toolExecutor.execute(
          toolName,
          args,
          { requestId: ctx.requestId, sessionId: ctx.sessionId },
          {
            onStart: (payload) => {
              trace.push({ emit: { event: 'tool_call_start', data: payload } });
              if (capabilityType) {
                trace.push({
                  emit: {
                    event: 'capability',
                    data: {
                      type: capabilityType,
                      status: 'start',
                      data: { toolName: payload.toolName, callId: payload.callId }
                    }
                  }
                });
              }
            },
            onEnd: (payload) => {
              trace.push({ emit: { event: 'tool_call_end', data: payload } });
              if (capabilityType) {
                trace.push({
                  emit: {
                    event: 'capability',
                    data: {
                      type: capabilityType,
                      status: payload.ok ? 'finish' : 'error',
                      data: { toolName: payload.toolName, callId: payload.callId }
                    }
                  }
                });
              }
            }
          }
        );

        for (const signal of trace) {
          yield signal;
        }

        if (result.ok) {
          ctx.state.toolOutput = result.output;

          if (toolName.startsWith('handoff.')) {
            const output = result.output as { to?: unknown; from?: unknown; reason?: unknown } | undefined;
            if (typeof output?.to === 'string') {
              yield {
                emit: {
                  event: 'handoff',
                  data: {
                    from: typeof output.from === 'string' ? output.from : 'main',
                    to: output.to,
                    reason: typeof output.reason === 'string' ? output.reason : 'tool_handoff'
                  }
                }
              };
            }
          }
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
