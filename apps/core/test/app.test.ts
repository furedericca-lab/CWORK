import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import type { DifyApiClient } from '../src/dify/api-client';

const authHeaders = {
  authorization: 'Bearer dev-token'
};

const createMockDifyApiClient = () => {
  return {
    async *chatMessagesStream(request: { payload: Record<string, unknown> }) {
      const conversationId =
        typeof request.payload.conversation_id === 'string' ? request.payload.conversation_id : 'conv_new';
      yield { event: 'message', delta: 'Scaffold runtime response' };
      yield {
        event: 'message_end',
        conversation_id: conversationId,
        metadata: {
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15
          }
        }
      };
    },
    async *workflowRunStream() {
      yield {
        event: 'workflow_finished',
        data: {
          outputs: {
            astrbot_wf_output: 'workflow result'
          }
        }
      };
    }
  } as unknown as DifyApiClient;
};

describe('core api routes', () => {
  it('returns healthz without auth', async () => {
    const app = await buildApp({ difyApiClient: createMockDifyApiClient() });
    const res = await app.inject({ method: 'GET', url: '/api/v1/healthz' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });

    await app.close();
  });

  it('rejects protected routes without bearer token', async () => {
    const app = await buildApp({ difyApiClient: createMockDifyApiClient() });
    const res = await app.inject({ method: 'GET', url: '/api/v1/runtime/sessions' });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({
      error: {
        code: 'UNAUTHORIZED',
        message: expect.any(String),
        requestId: expect.any(String)
      }
    });

    await app.close();
  });

  it('supports session pagination defaults and explicit page/pageSize', async () => {
    const app = await buildApp({ difyApiClient: createMockDifyApiClient() });

    await app.inject({
      method: 'POST',
      url: '/api/v1/runtime/chat',
      headers: authHeaders,
      payload: { sessionId: 'sess_1', message: 'hello' }
    });
    await app.inject({
      method: 'POST',
      url: '/api/v1/runtime/chat',
      headers: authHeaders,
      payload: { sessionId: 'sess_2', message: 'hello' }
    });

    const defaultRes = await app.inject({
      method: 'GET',
      url: '/api/v1/runtime/sessions',
      headers: authHeaders
    });
    expect(defaultRes.statusCode).toBe(200);
    expect(defaultRes.json()).toMatchObject({
      total: 2,
      page: 1,
      pageSize: 20
    });

    const pagedRes = await app.inject({
      method: 'GET',
      url: '/api/v1/runtime/sessions?page=2&pageSize=1',
      headers: authHeaders
    });
    expect(pagedRes.statusCode).toBe(200);
    expect(pagedRes.json()).toMatchObject({
      total: 2,
      page: 2,
      pageSize: 1
    });
    expect(pagedRes.json().items).toHaveLength(1);

    await app.close();
  });

  it('propagates x-request-id header', async () => {
    const app = await buildApp({ difyApiClient: createMockDifyApiClient() });
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/healthz',
      headers: {
        'x-request-id': 'req_test_123'
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['x-request-id']).toBe('req_test_123');

    await app.close();
  });

  it('returns validation error envelope for invalid runtime chat payload', async () => {
    const app = await buildApp({ difyApiClient: createMockDifyApiClient() });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/runtime/chat',
      headers: authHeaders,
      payload: {
        message: []
      }
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      error: {
        code: 'VALIDATION_ERROR',
        requestId: expect.any(String)
      }
    });

    await app.close();
  });

  it('streams contract-compliant SSE events for valid chat request', async () => {
    const app = await buildApp({ difyApiClient: createMockDifyApiClient() });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/runtime/chat',
      headers: authHeaders,
      payload: {
        sessionId: 'sess_stream',
        message: 'hello'
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.payload).toContain('event: meta');
    expect(res.payload).toContain('event: delta');
    expect(res.payload).toContain('event: final_result');
    expect(res.payload).toContain('event: done');
    expect(res.payload.indexOf('event: meta')).toBeLessThan(res.payload.indexOf('event: delta'));
    expect(res.payload.indexOf('event: delta')).toBeLessThan(res.payload.indexOf('event: final_result'));
    expect(res.payload.indexOf('event: final_result')).toBeLessThan(res.payload.indexOf('event: done'));

    await app.close();
  });

  it('supports get/put dify config with masking and validation', async () => {
    const app = await buildApp({ difyApiClient: createMockDifyApiClient() });

    const getRes = await app.inject({
      method: 'GET',
      url: '/api/v1/config/dify',
      headers: authHeaders
    });

    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().masked.difyApiKey).toBe('***');

    const putRes = await app.inject({
      method: 'PUT',
      url: '/api/v1/config/dify',
      headers: authHeaders,
      payload: {
        providerId: 'default',
        difyApiBase: 'https://api.dify.ai/v1',
        difyApiType: 'workflow',
        difyWorkflowOutputKey: 'wf_output',
        difyQueryInputKey: 'query',
        timeoutSec: 30,
        variables: {}
      }
    });

    expect(putRes.statusCode).toBe(200);
    expect(putRes.json().difyApiType).toBe('workflow');
    expect(putRes.json().masked.difyApiKey).toBe('***');

    const invalidPutRes = await app.inject({
      method: 'PUT',
      url: '/api/v1/config/dify',
      headers: authHeaders,
      payload: {
        providerId: 'default',
        difyApiBase: 'https://api.dify.ai/v1',
        difyApiType: 'invalid',
        difyWorkflowOutputKey: 'wf_output',
        difyQueryInputKey: 'query',
        timeoutSec: 30,
        variables: {}
      }
    });

    expect(invalidPutRes.statusCode).toBe(400);
    expect(invalidPutRes.json().error.code).toBe('VALIDATION_ERROR');

    await app.close();
  });
});
