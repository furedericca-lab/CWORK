import { describe, expect, it } from 'vitest';
import type { RuntimePipelineContext, PipelineStage } from '../../src/pipeline/types';
import { RuntimePipelineScheduler } from '../../src/pipeline/scheduler';
import { SseWriter } from '../../src/sse/writer';

const createContext = (): RuntimePipelineContext => ({
  requestId: 'req_1',
  sessionId: 'sess_1',
  receivedAt: new Date().toISOString(),
  request: {
    sessionId: 'sess_1',
    message: 'hello',
    enableStreaming: true
  },
  normalizedMessage: [],
  session: {
    sessionId: 'sess_1',
    displayName: 'default',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    sessionVariables: {}
  },
  sseEvents: [],
  writer: new SseWriter({ write: () => undefined, end: () => undefined }),
  state: {}
});

describe('RuntimePipelineScheduler', () => {
  it('keeps deterministic stage execution order', async () => {
    const order: string[] = [];

    const stageA: PipelineStage = {
      name: 'A',
      async run() {
        order.push('A');
      }
    };

    const stageB: PipelineStage = {
      name: 'B',
      async *run() {
        order.push('B1');
        yield;
        order.push('B2');
      }
    };

    const stageC: PipelineStage = {
      name: 'C',
      async run() {
        order.push('C');
      }
    };

    const scheduler = new RuntimePipelineScheduler().registerMany([stageA, stageB, stageC]);
    await scheduler.execute(createContext());

    expect(order).toEqual(['A', 'B1', 'B2', 'C']);
    expect(scheduler.getStageNames()).toEqual(['A', 'B', 'C']);
  });

  it('stops propagation when a stage emits stop signal', async () => {
    const order: string[] = [];

    const stageA: PipelineStage = {
      name: 'A',
      async run() {
        order.push('A');
      }
    };

    const stageB: PipelineStage = {
      name: 'B',
      async run() {
        order.push('B');
        return { stop: true, reason: 'halt' };
      }
    };

    const stageC: PipelineStage = {
      name: 'C',
      async run() {
        order.push('C');
      }
    };

    const scheduler = new RuntimePipelineScheduler().registerMany([stageA, stageB, stageC]);
    const result = await scheduler.execute(createContext());

    expect(order).toEqual(['A', 'B']);
    expect(result).toEqual({ stopped: true, stopReason: 'halt' });
  });
});
