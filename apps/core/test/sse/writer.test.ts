import { describe, expect, it, vi } from 'vitest';
import { SseWriter } from '../../src/sse/writer';

describe('SseWriter', () => {
  it('writes runtime events in expected order and closes with done', () => {
    const chunks: string[] = [];
    const writer = new SseWriter({
      write(chunk) {
        chunks.push(chunk);
      },
      end() {
        chunks.push('[[END]]');
      }
    });

    writer.writeEvent('meta', { requestId: 'req_1', sessionId: 'sess_1', timestamp: '2026-03-05T00:00:00.000Z' });
    writer.writeEvent('delta', { text: 'hello', index: 0 });
    writer.writeEvent('final_result', {
      resultType: 'llm_result',
      messageChain: [{ type: 'plain', text: 'done' }]
    });
    writer.closeWithDone();

    const eventNames = chunks.filter((line) => line.startsWith('event:')).map((line) => line.replace('event: ', '').trim());
    expect(eventNames).toEqual(['meta', 'delta', 'final_result', 'done']);
    expect(chunks[chunks.length - 1]).toBe('[[END]]');
  });

  it('emits heartbeat and prevents writes after close', () => {
    const chunks: string[] = [];
    const timers: Array<() => void> = [];
    const setIntervalFn = vi.fn((callback: () => void) => {
      timers.push(callback);
      return 1 as unknown as NodeJS.Timeout;
    });
    const clearIntervalFn = vi.fn();

    const writer = new SseWriter(
      {
        write(chunk) {
          chunks.push(chunk);
        },
        end() {
          chunks.push('[[END]]');
        }
      },
      {
        heartbeatMs: 10,
        setIntervalFn,
        clearIntervalFn
      }
    );

    writer.startHeartbeat();
    timers[0]?.();
    writer.closeWithDone();
    const acceptedAfterClose = writer.writeEvent('delta', { text: 'late', index: 1 });

    expect(setIntervalFn).toHaveBeenCalledTimes(1);
    expect(clearIntervalFn).toHaveBeenCalledTimes(1);
    expect(chunks.some((line) => line.startsWith(': heartbeat'))).toBe(true);
    expect(acceptedAfterClose).toBe(false);
  });
});
