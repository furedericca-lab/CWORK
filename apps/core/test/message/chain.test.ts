import { describe, expect, it } from 'vitest';
import { deserializeMessageChain, normalizeMessageInput, serializeMessageChain } from '../../src/message/chain';

describe('message chain normalization', () => {
  it('normalizes plain string message to plain message part', () => {
    expect(normalizeMessageInput('hello')).toEqual([{ type: 'plain', text: 'hello' }]);
  });

  it('keeps all part variants as valid normalized parts', () => {
    const parts = normalizeMessageInput([
      { type: 'plain', text: 'text' },
      { type: 'image', url: 'https://example.com/a.png' },
      { type: 'file', filename: 'a.txt', attachmentId: 'f1' },
      { type: 'video', path: '/tmp/v.mp4' },
      { type: 'reply', messageId: 'msg_1' },
      { type: 'record', url: 'https://example.com/r.mp3' }
    ]);

    expect(parts).toHaveLength(6);
  });

  it('serializes and deserializes deterministically', () => {
    const normalized = normalizeMessageInput([{ type: 'plain', text: 'hello' }]);
    const raw = serializeMessageChain(normalized);
    const restored = deserializeMessageChain(raw);

    expect(restored).toEqual(normalized);
  });
});
