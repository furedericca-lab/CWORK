import { describe, expect, it } from 'vitest';
import { parseDifySseStream } from '../../src/dify/stream-parser';

const toStream = (chunks: string[]): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    }
  });
};

describe('parseDifySseStream', () => {
  it('parses incremental SSE chunks into frames', async () => {
    const stream = toStream([
      'data: {"event":"message","delta":"hel"}\n\n',
      'data: {"event":"message","delta":"lo"}\n\n',
      'data: [DONE]\n\n'
    ]);

    const frames = [];
    for await (const frame of parseDifySseStream(stream)) {
      frames.push(frame);
    }

    expect(frames).toEqual([
      { event: 'message', delta: 'hel' },
      { event: 'message', delta: 'lo' }
    ]);
  });

  it('maps malformed frames to parse errors', async () => {
    const stream = toStream(['data: {not-json}\n\n']);

    const frames = [];
    for await (const frame of parseDifySseStream(stream)) {
      frames.push(frame);
    }

    expect(frames).toEqual([{ event: 'error', code: 'PARSE_ERROR', message: 'Invalid frame: {not-json}' }]);
  });
});
