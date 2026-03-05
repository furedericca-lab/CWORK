import { describe, expect, it } from 'vitest';
import { PreprocessStage } from '../../src/pipeline/stages/preprocess.stage';
import { ProcessStage } from '../../src/pipeline/stages/process.stage';
import { RespondStage } from '../../src/pipeline/stages/respond.stage';
import { ResultDecorateStage } from '../../src/pipeline/stages/result-decorate.stage';
import { WakeCheckStage } from '../../src/pipeline/stages/wake-check.stage';
import { RuntimePipelineScheduler } from '../../src/pipeline/scheduler';
import type { RuntimePipelineContext } from '../../src/pipeline/types';
import { createInMemoryRepositories } from '../../src/repo/memory';
import type { DifyRunner } from '../../src/dify/runner';
import { SseWriter } from '../../src/sse/writer';

const parseEventsFromSink = (chunks: string[]): string[] => {
  return chunks
    .filter((line) => line.startsWith('event: '))
    .map((line) => line.slice('event: '.length).trim());
};

describe('baseline stage set integration', () => {
  it('executes wake/preprocess/process/decorate/respond and emits ordered terminal stream', async () => {
    const repositories = createInMemoryRepositories();
    const chunks: string[] = [];
    const writer = new SseWriter({
      write(chunk) {
        chunks.push(chunk);
      },
      end() {
        chunks.push('[[END]]');
      }
    });

    await repositories.sessions.upsert({
      sessionId: 'sess_x',
      displayName: 'default',
      createdAt: '2026-03-05T00:00:00.000Z',
      updatedAt: '2026-03-05T00:00:00.000Z',
      lastActivityAt: '2026-03-05T00:00:00.000Z',
      sessionVariables: {}
    });

    const fakeRunner = {
      async run() {
        return {
          events: [
            { event: 'delta', data: { text: 'hello', index: 0 } },
            {
              event: 'final_result',
              data: {
                resultType: 'llm_result',
                messageChain: [{ type: 'plain', text: 'done' }]
              }
            }
          ],
          nextSession: {
            sessionId: 'sess_x',
            displayName: 'default',
            createdAt: '2026-03-05T00:00:00.000Z',
            updatedAt: '2026-03-05T00:00:00.000Z',
            lastActivityAt: '2026-03-05T00:00:00.000Z',
            sessionVariables: {},
            difyConversationId: 'conv_1'
          }
        };
      }
    } as unknown as DifyRunner;

    const context: RuntimePipelineContext = {
      requestId: 'req_x',
      sessionId: 'sess_x',
      receivedAt: '2026-03-05T00:00:00.000Z',
      request: {
        sessionId: 'sess_x',
        message: 'hello',
        enableStreaming: true
      },
      normalizedMessage: [],
      session: {
        sessionId: 'sess_x',
        displayName: 'default',
        createdAt: '2026-03-05T00:00:00.000Z',
        updatedAt: '2026-03-05T00:00:00.000Z',
        lastActivityAt: '2026-03-05T00:00:00.000Z',
        sessionVariables: {}
      },
      sseEvents: [],
      writer,
      state: {}
    };

    const scheduler = new RuntimePipelineScheduler().registerMany([
      new WakeCheckStage(),
      new PreprocessStage(),
      new ProcessStage(fakeRunner, repositories),
      new ResultDecorateStage(),
      new RespondStage()
    ]);

    await scheduler.execute(context);

    expect(context.normalizedMessage).toEqual([{ type: 'plain', text: 'hello' }]);
    expect(context.sseEvents.map((item) => item.event)).toEqual(['delta', 'final_result']);
    expect(parseEventsFromSink(chunks)).toEqual(['meta', 'delta', 'final_result', 'done']);
  });
});
