import { buildApp } from '../src/app';
import type { DifyApiClient } from '../src/dify/api-client';

const authHeaders = {
  authorization: 'Bearer dev-token'
};

const createMockDifyApiClient = () => {
  return {
    async *chatMessagesStream() {
      yield { event: 'message', delta: 'reliability-smoke' };
      yield { event: 'message_end', conversation_id: 'conv_reliability' };
    }
  } as unknown as DifyApiClient;
};

const run = async () => {
  const app = await buildApp({ difyApiClient: createMockDifyApiClient() });

  try {
    const badPluginImport = await app.inject({
      method: 'POST',
      url: '/api/v1/plugins/import/local',
      headers: authHeaders,
      payload: {
        path: '/tmp/non-existent-plugin'
      }
    });
    if (badPluginImport.statusCode !== 404) {
      throw new Error(`Expected plugin import failure 404, got ${badPluginImport.statusCode}`);
    }

    const health = await app.inject({ method: 'GET', url: '/api/v1/healthz' });
    if (health.statusCode !== 200) {
      throw new Error(`Health degraded after plugin failure: ${health.statusCode}`);
    }

    const runtime = await app.inject({
      method: 'POST',
      url: '/api/v1/runtime/chat',
      headers: authHeaders,
      payload: {
        sessionId: 'sess_reliability',
        message: 'smoke'
      }
    });
    if (runtime.statusCode !== 200 || !runtime.payload.includes('event: done')) {
      throw new Error(`Runtime degraded after plugin failure: ${runtime.statusCode}`);
    }

    const capabilities = await app.inject({
      method: 'GET',
      url: '/api/v1/capabilities/status',
      headers: authHeaders
    });
    if (capabilities.statusCode !== 200) {
      throw new Error(`Capabilities endpoint failed after stress: ${capabilities.statusCode}`);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          checks: ['plugin_failure_isolated', 'healthz_ok', 'runtime_chat_ok', 'capabilities_ok']
        },
        null,
        2
      )
    );
  } finally {
    await app.close();
  }
};

void run();
