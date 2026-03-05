import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiClient, parseSseBlocks } from './client';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('parseSseBlocks', () => {
  it('parses complete SSE blocks and returns remaining buffer', () => {
    const input = [
      'event: meta',
      'data: {"requestId":"r1","sessionId":"s1","timestamp":"2026-03-05T00:00:00Z"}',
      '',
      'event: done',
      'data: {"ok":true}',
      '',
      'event: delta',
      'data: {"text":"partial"}'
    ].join('\n');

    const parsed = parseSseBlocks(input);
    expect(parsed.events).toHaveLength(2);
    expect(parsed.events[0]).toEqual({
      event: 'meta',
      data: '{"requestId":"r1","sessionId":"s1","timestamp":"2026-03-05T00:00:00Z"}'
    });
    expect(parsed.events[1]).toEqual({
      event: 'done',
      data: '{"ok":true}'
    });
    expect(parsed.rest).toBe('event: delta\ndata: {"text":"partial"}');
  });

  it('ignores malformed blocks without event or data', () => {
    const input = ['event: meta', '', 'data: {"ok":true}', '', 'event: done', 'data: {"ok":true}', '', ''].join('\n');
    const parsed = parseSseBlocks(input);

    expect(parsed.events).toEqual([
      {
        event: 'done',
        data: '{"ok":true}'
      }
    ]);
    expect(parsed.rest).toBe('');
  });
});

describe('api client request tracing', () => {
  it('propagates auth and emits request trace with backend request id', async () => {
    const traces: Array<{ requestId: string; statusCode: number }> = [];
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'req_from_backend'
        }
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = createApiClient({
      getAuthToken: () => 'token_123',
      onTrace: (entry) => {
        traces.push({ requestId: entry.requestId, statusCode: entry.statusCode });
      }
    });

    const result = await client.getHealthz();
    expect(result).toEqual({ ok: true });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get('authorization')).toBe('Bearer token_123');
    expect(headers.get('x-request-id')).toMatch(/^web_/);

    expect(traces).toEqual([{ requestId: 'req_from_backend', statusCode: 200 }]);
  });
});
