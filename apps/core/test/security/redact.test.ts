import { describe, expect, it } from 'vitest';
import { redactSensitiveValue } from '../../src/security/redact';

describe('redactSensitiveValue', () => {
  it('redacts sensitive keys recursively and keeps non-sensitive fields', () => {
    const input = {
      token: 'abc',
      nested: {
        password: 'pwd',
        safe: 'ok'
      },
      list: [
        {
          apiKey: 'k1',
          name: 'item'
        }
      ]
    };

    const redacted = redactSensitiveValue(input);
    expect(redacted).toEqual({
      token: '***',
      nested: {
        password: '***',
        safe: 'ok'
      },
      list: [
        {
          apiKey: '***',
          name: 'item'
        }
      ]
    });
  });
});
