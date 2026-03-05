import { describe, expect, it } from 'vitest';
import { createInMemoryRepositories } from '../../src/repo/memory';
import { ToolExecutor } from '../../src/tools/executor';
import { ToolRegistry } from '../../src/tools/registry';

describe('ToolExecutor', () => {
  it('handles success, bad args, timeout and exception paths', async () => {
    const repositories = createInMemoryRepositories();
    const registry = new ToolRegistry(repositories.tools);
    const executor = new ToolExecutor(registry, { timeoutMs: 10 });

    await registry.register({
      meta: {
        toolName: 'tool.sum',
        description: 'sum',
        enabled: true,
        source: 'builtin',
        schema: {
          a: { type: 'number', required: true },
          b: { type: 'number', required: true }
        }
      },
      handler(args) {
        return Number(args.a) + Number(args.b);
      }
    });

    await registry.register({
      meta: {
        toolName: 'tool.throw',
        description: 'throw',
        enabled: true,
        source: 'builtin',
        schema: {}
      },
      handler() {
        throw new Error('boom');
      }
    });

    await registry.register({
      meta: {
        toolName: 'tool.slow',
        description: 'slow',
        enabled: true,
        source: 'builtin',
        schema: {}
      },
      async handler() {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return 'done';
      }
    });

    const success = await executor.execute('tool.sum', { a: 1, b: 2 }, { requestId: 'req_1' });
    expect(success).toMatchObject({ ok: true, output: 3 });

    const badArgs = await executor.execute('tool.sum', { a: 1 }, { requestId: 'req_2' });
    expect(badArgs).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });

    const thrown = await executor.execute('tool.throw', {}, { requestId: 'req_3' });
    expect(thrown).toMatchObject({ ok: false, error: { code: 'INTERNAL_ERROR' } });

    const timedOut = await executor.execute('tool.slow', {}, { requestId: 'req_4' });
    expect(timedOut).toMatchObject({ ok: false, error: { code: 'TIMEOUT' } });
  });

  it('emits terminal onEnd hook for both success and failure', async () => {
    const repositories = createInMemoryRepositories();
    const registry = new ToolRegistry(repositories.tools);
    const executor = new ToolExecutor(registry, { timeoutMs: 50 });

    await registry.register({
      meta: {
        toolName: 'tool.ok',
        description: 'ok',
        enabled: true,
        source: 'builtin',
        schema: {}
      },
      handler() {
        return { value: 1 };
      }
    });

    await registry.register({
      meta: {
        toolName: 'tool.fail',
        description: 'fail',
        enabled: true,
        source: 'builtin',
        schema: {}
      },
      handler() {
        throw new Error('boom');
      }
    });

    const starts: string[] = [];
    const ends: string[] = [];

    await executor.execute('tool.ok', {}, { requestId: 'req_1' }, {
      onStart(payload) {
        starts.push(payload.callId);
      },
      onEnd(payload) {
        ends.push(payload.callId);
      }
    });

    await executor.execute('tool.fail', {}, { requestId: 'req_2' }, {
      onStart(payload) {
        starts.push(payload.callId);
      },
      onEnd(payload) {
        ends.push(payload.callId);
      }
    });

    expect(starts).toHaveLength(2);
    expect(ends).toHaveLength(2);
    expect(new Set(ends).size).toBe(2);
  });
});
