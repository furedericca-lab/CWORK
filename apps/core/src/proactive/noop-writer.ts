import { SseWriter } from '../sse/writer';

export const createNoopSseWriter = (): SseWriter => {
  return new SseWriter({
    write: () => undefined,
    end: () => undefined
  });
};
