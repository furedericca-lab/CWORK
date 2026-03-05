// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

const jsonResponse = (body: unknown, requestId: string): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'x-request-id': requestId
    }
  });

describe('web console e2e smoke', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('boots the operations console and loads overview health panels', async () => {
    document.body.innerHTML = '<div id="root"></div>';

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/v1/healthz')) {
        return jsonResponse({ ok: true }, 'req_healthz');
      }
      if (url.endsWith('/api/v1/readyz')) {
        return jsonResponse({ ok: true, provider: 'dify' }, 'req_readyz');
      }
      if (url.endsWith('/api/v1/capabilities/status')) {
        return jsonResponse(
          {
            dify: { enabled: true, healthy: true },
            plugins: { enabled: true, healthy: true },
            skills: { enabled: true, healthy: true },
            mcp: { enabled: true, healthy: true },
            search: { enabled: true, healthy: true },
            knowledge: { enabled: true, healthy: true },
            sandbox: { enabled: false, healthy: true }
          },
          'req_caps'
        );
      }

      return jsonResponse({}, 'req_default');
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.resetModules();

    await import('../main');
    for (let i = 0; i < 50 && fetchMock.mock.calls.length === 0; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    const text = document.body.textContent ?? '';
    expect(text).toContain('CWORK 运维控制台');
    expect(text).toContain('服务健康');
    expect(text).toContain('能力状态');
    expect(fetchMock.mock.calls.length).toBeGreaterThan(0);
  });
});
