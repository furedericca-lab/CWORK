import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app';
import type { DifyApiClient } from '../../src/dify/api-client';

const createMockDifyApiClient = () => {
  return {
    async *chatMessagesStream() {
      yield { event: 'message', delta: 'auth coverage' };
      yield { event: 'message_end', conversation_id: 'conv_auth' };
    }
  } as unknown as DifyApiClient;
};

describe('auth coverage', () => {
  it('keeps management/runtime endpoints protected by bearer token', async () => {
    const app = await buildApp({ difyApiClient: createMockDifyApiClient() });

    const protectedRequests: Array<{ method: 'GET' | 'POST' | 'PUT' | 'DELETE'; url: string; payload?: unknown }> = [
      { method: 'GET', url: '/api/v1/runtime/sessions' },
      { method: 'GET', url: '/api/v1/config/dify' },
      { method: 'PUT', url: '/api/v1/config/dify', payload: {} },
      { method: 'POST', url: '/api/v1/runtime/chat', payload: { message: 'x' } },
      { method: 'GET', url: '/api/v1/tools' },
      { method: 'POST', url: '/api/v1/tools/execute', payload: { toolName: 'tool.echo', arguments: { text: 'x' } } },
      { method: 'GET', url: '/api/v1/skills' },
      { method: 'GET', url: '/api/v1/plugins' },
      { method: 'GET', url: '/api/v1/subagents' },
      { method: 'GET', url: '/api/v1/subagents/available-tools' },
      { method: 'GET', url: '/api/v1/proactive/jobs' },
      { method: 'GET', url: '/api/v1/capabilities/status' },
      { method: 'GET', url: '/api/v1/kb/documents' },
      { method: 'POST', url: '/api/v1/kb/retrieve', payload: { query: 'x' } }
    ];

    for (const req of protectedRequests) {
      const res = await app.inject({
        method: req.method,
        url: req.url,
        ...(req.payload ? { payload: req.payload } : {})
      });
      expect(res.statusCode, `${req.method} ${req.url}`).toBe(401);
      expect(res.json()).toMatchObject({
        error: {
          code: 'UNAUTHORIZED'
        }
      });
    }

    const publicHealth = await app.inject({ method: 'GET', url: '/api/v1/healthz' });
    expect(publicHealth.statusCode).toBe(200);
    const publicReady = await app.inject({ method: 'GET', url: '/api/v1/readyz' });
    expect(publicReady.statusCode).toBe(200);

    await app.close();
  });
});
