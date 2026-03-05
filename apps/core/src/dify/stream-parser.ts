import type { DifyStreamFrame } from './types';

const parseEventChunk = (chunk: string): DifyStreamFrame[] => {
  const frames: DifyStreamFrame[] = [];
  const events = chunk.split('\n\n');

  for (const event of events) {
    const trimmed = event.trim();
    if (!trimmed) {
      continue;
    }

    const dataLines = trimmed
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice('data:'.length).trim());

    for (const data of dataLines) {
      if (!data || data === '[DONE]') {
        continue;
      }

      try {
        frames.push(JSON.parse(data) as DifyStreamFrame);
      } catch {
        frames.push({ event: 'error', code: 'PARSE_ERROR', message: `Invalid frame: ${data}` });
      }
    }
  }

  return frames;
};

export const parseDifySseStream = async function* (
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<DifyStreamFrame, void, void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const result = await reader.read();
    if (result.done) {
      break;
    }

    buffer += decoder.decode(result.value, { stream: true });

    const lastBoundary = buffer.lastIndexOf('\n\n');
    if (lastBoundary === -1) {
      continue;
    }

    const consumable = buffer.slice(0, lastBoundary + 2);
    buffer = buffer.slice(lastBoundary + 2);

    for (const frame of parseEventChunk(consumable)) {
      yield frame;
    }
  }

  if (buffer.trim()) {
    for (const frame of parseEventChunk(buffer)) {
      yield frame;
    }
  }
};
