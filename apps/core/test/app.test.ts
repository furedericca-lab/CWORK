import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';

describe('core health routes', () => {
  it('returns healthz', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/v1/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    await app.close();
  });
});
