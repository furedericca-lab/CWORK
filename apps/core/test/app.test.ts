import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';

const authHeaders = {
  authorization: 'Bearer dev-token'
};

describe('core api routes', () => {
  it('returns healthz without auth', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/v1/healthz' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });

    await app.close();
  });

  it('rejects protected routes without bearer token', async () => {
    const app = await buildApp();
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

  it('accepts protected routes with valid bearer token', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/runtime/sessions',
      headers: authHeaders
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20
    });

    await app.close();
  });

  it('propagates x-request-id header', async () => {
    const app = await buildApp();
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
    const app = await buildApp();
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
});
