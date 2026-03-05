import { describe, expect, it } from 'vitest';
import { runtimeChatRequestSchema } from './runtime';

describe('runtimeChatRequestSchema', () => {
  it('accepts plain string message', () => {
    const parsed = runtimeChatRequestSchema.parse({ message: 'hello' });
    expect(parsed.message).toBe('hello');
  });

  it('rejects empty parts array', () => {
    const result = runtimeChatRequestSchema.safeParse({ message: [] });
    expect(result.success).toBe(false);
  });
});
