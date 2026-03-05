import { describe, expect, it, vi } from 'vitest';
import { DifyApiClient } from '../../src/dify/api-client';

const streamResponse = (chunks: string[]): Response => {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    }
  });

  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream'
    }
  });
};

describe('DifyApiClient', () => {
  it('parses chat stream response', async () => {
    const fetcher = vi.fn(async () =>
      streamResponse(['data: {"event":"message","delta":"hello"}\n\n', 'data: [DONE]\n\n'])
    );

    const client = new DifyApiClient({ fetcher: fetcher as unknown as typeof fetch });

    const frames = [];
    for await (const frame of client.chatMessagesStream({
      apiBase: 'https://api.dify.ai/v1',
      apiKey: 'key',
      mode: 'chat',
      payload: { query: 'hello' },
      timeoutSec: 5
    })) {
      frames.push(frame);
    }

    expect(frames).toEqual([{ event: 'message', delta: 'hello' }]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('retries upstream 5xx and succeeds on second attempt', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response('error', { status: 503 }))
      .mockResolvedValueOnce(streamResponse(['data: {"event":"message","delta":"ok"}\n\n']));

    const client = new DifyApiClient({ fetcher: fetcher as unknown as typeof fetch, retries: 1 });

    const frames = [];
    for await (const frame of client.chatMessagesStream({
      apiBase: 'https://api.dify.ai/v1',
      apiKey: 'key',
      mode: 'chat',
      payload: { query: 'hello' },
      timeoutSec: 5
    })) {
      frames.push(frame);
    }

    expect(frames).toEqual([{ event: 'message', delta: 'ok' }]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
