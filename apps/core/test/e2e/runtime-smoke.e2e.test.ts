import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app';
import type { DifyApiClient } from '../../src/dify/api-client';

const authHeaders = {
  authorization: 'Bearer dev-token'
};

const createMockDifyApiClient = () => {
  return {
    async *chatMessagesStream() {
      yield { event: 'message', delta: 'e2e runtime response' };
      yield {
        event: 'message_end',
        conversation_id: 'conv_e2e',
        metadata: {
          usage: {
            prompt_tokens: 8,
            completion_tokens: 5,
            total_tokens: 13
          }
        }
      };
    }
  } as unknown as DifyApiClient;
};

describe('e2e runtime smoke', () => {
  it('runs health -> runtime chat -> capabilities flow', async () => {
    const app = await buildApp({ difyApiClient: createMockDifyApiClient() });

    const health = await app.inject({ method: 'GET', url: '/api/v1/healthz' });
    expect(health.statusCode).toBe(200);

    const chat = await app.inject({
      method: 'POST',
      url: '/api/v1/runtime/chat',
      headers: authHeaders,
      payload: {
        sessionId: 'sess_e2e',
        message: 'hello e2e'
      }
    });
    expect(chat.statusCode).toBe(200);
    expect(chat.headers['content-type']).toContain('text/event-stream');
    expect(chat.payload).toContain('event: final_result');
    expect(chat.payload).toContain('event: done');

    const capabilities = await app.inject({
      method: 'GET',
      url: '/api/v1/capabilities/status',
      headers: authHeaders
    });
    expect(capabilities.statusCode).toBe(200);
    expect(capabilities.json()).toMatchObject({
      dify: { enabled: true },
      search: { enabled: true },
      knowledge: { enabled: true }
    });

    await app.close();
  });
});
