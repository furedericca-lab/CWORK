import { performance } from 'node:perf_hooks';
import { buildApp } from '../src/app';
import type { DifyApiClient } from '../src/dify/api-client';

const authHeaders = {
  authorization: 'Bearer dev-token'
};

const percentile = (values: number[], p: number): number => {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index] ?? 0;
};

const createMockDifyApiClient = () => {
  return {
    async *chatMessagesStream() {
      yield { event: 'message', delta: 'perf-smoke-response' };
      yield {
        event: 'message_end',
        conversation_id: 'conv_perf',
        metadata: { usage: { prompt_tokens: 4, completion_tokens: 6, total_tokens: 10 } }
      };
    }
  } as unknown as DifyApiClient;
};

const run = async () => {
  const app = await buildApp({ difyApiClient: createMockDifyApiClient() });

  try {
    const healthRuns: number[] = [];
    for (let i = 0; i < 60; i += 1) {
      const start = performance.now();
      const response = await app.inject({ method: 'GET', url: '/api/v1/healthz' });
      const duration = performance.now() - start;
      if (response.statusCode !== 200) {
        throw new Error(`healthz failed with ${response.statusCode}`);
      }
      healthRuns.push(duration);
    }

    const runtimeRuns: number[] = [];
    for (let i = 0; i < 24; i += 1) {
      const start = performance.now();
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/runtime/chat',
        headers: authHeaders,
        payload: {
          sessionId: `perf_${i}`,
          message: 'perf smoke'
        }
      });
      const duration = performance.now() - start;
      if (response.statusCode !== 200 || !response.payload.includes('event: done')) {
        throw new Error(`runtime chat failed with ${response.statusCode}`);
      }
      runtimeRuns.push(duration);
    }

    const report = {
      health: {
        runs: healthRuns.length,
        p50Ms: Number(percentile(healthRuns, 50).toFixed(2)),
        p95Ms: Number(percentile(healthRuns, 95).toFixed(2))
      },
      runtimeChat: {
        runs: runtimeRuns.length,
        p50Ms: Number(percentile(runtimeRuns, 50).toFixed(2)),
        p95Ms: Number(percentile(runtimeRuns, 95).toFixed(2))
      }
    };

    console.log(JSON.stringify(report, null, 2));
  } finally {
    await app.close();
  }
};

void run();
