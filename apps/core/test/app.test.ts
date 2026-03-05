import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
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

  it('emits tool_call_start and tool_call_end traces in runtime SSE', async () => {
    const app = await buildApp({ difyApiClient: createMockDifyApiClient() });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/runtime/chat',
      headers: authHeaders,
      payload: {
        sessionId: 'sess_tool',
        message: 'hello',
        metadata: {
          toolCall: {
            toolName: 'tool.echo',
            arguments: { text: 'hello-tool' }
          }
        }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.payload).toContain('event: tool_call_start');
    expect(res.payload).toContain('event: tool_call_end');
    expect(res.payload.indexOf('event: tool_call_start')).toBeLessThan(res.payload.indexOf('event: tool_call_end'));

    await app.close();
  });

  it('supports subagent, proactive, knowledge, and capability APIs', async () => {
    const app = await buildApp({ difyApiClient: createMockDifyApiClient() });

    const subagentPut = await app.inject({
      method: 'PUT',
      url: '/api/v1/subagents',
      headers: authHeaders,
      payload: {
        enable: true,
        removeMainDuplicateTools: false,
        agents: [
          {
            subagentId: 'research',
            name: 'Research Agent',
            enabled: true,
            tools: ['web.search', 'kb.retrieve']
          }
        ]
      }
    });
    expect(subagentPut.statusCode).toBe(200);

    const availableTools = await app.inject({
      method: 'GET',
      url: '/api/v1/subagents/available-tools',
      headers: authHeaders
    });
    expect(availableTools.statusCode).toBe(200);
    expect(availableTools.json().items.map((item: { toolName: string }) => item.toolName)).toContain('handoff.research');

    const handoffRuntime = await app.inject({
      method: 'POST',
      url: '/api/v1/runtime/chat',
      headers: authHeaders,
      payload: {
        sessionId: 'sess_handoff',
        message: 'route this',
        metadata: {
          subagentId: 'research'
        }
      }
    });
    expect(handoffRuntime.statusCode).toBe(200);
    expect(handoffRuntime.payload).toContain('event: handoff');

    const kbCreate = await app.inject({
      method: 'POST',
      url: '/api/v1/kb/documents',
      headers: authHeaders,
      payload: {
        title: 'Dify Notes',
        content: 'Dify is the only provider in CWORK.'
      }
    });
    expect(kbCreate.statusCode).toBe(200);
    const taskId = kbCreate.json().task.taskId as string;
    const docId = kbCreate.json().document.docId as string;

    const kbTask = await app.inject({
      method: 'GET',
      url: `/api/v1/kb/tasks/${taskId}`,
      headers: authHeaders
    });
    expect(kbTask.statusCode).toBe(200);
    expect(kbTask.json().status).toBe('completed');

    const kbRetrieve = await app.inject({
      method: 'POST',
      url: '/api/v1/kb/retrieve',
      headers: authHeaders,
      payload: { query: 'Dify provider', topK: 3 }
    });
    expect(kbRetrieve.statusCode).toBe(200);
    expect(Array.isArray(kbRetrieve.json().items)).toBe(true);

    const proactiveCreate = await app.inject({
      method: 'POST',
      url: '/api/v1/proactive/jobs',
      headers: authHeaders,
      payload: {
        name: 'once',
        sessionId: 'sess_1',
        prompt: 'hello',
        runAt: new Date(Date.now() + 60_000).toISOString()
      }
    });
    expect(proactiveCreate.statusCode).toBe(200);
    const jobId = proactiveCreate.json().jobId as string;

    const proactiveList = await app.inject({
      method: 'GET',
      url: '/api/v1/proactive/jobs',
      headers: authHeaders
    });
    expect(proactiveList.statusCode).toBe(200);
    expect(proactiveList.json().items.map((item: { jobId: string }) => item.jobId)).toContain(jobId);

    const capabilityStatus = await app.inject({
      method: 'GET',
      url: '/api/v1/capabilities/status',
      headers: authHeaders
    });
    expect(capabilityStatus.statusCode).toBe(200);
    expect(capabilityStatus.json()).toMatchObject({
      dify: { enabled: true },
      knowledge: { enabled: true },
      search: { enabled: true }
    });

    const proactiveDelete = await app.inject({
      method: 'DELETE',
      url: `/api/v1/proactive/jobs/${jobId}`,
      headers: authHeaders
    });
    expect(proactiveDelete.statusCode).toBe(200);

    const kbDelete = await app.inject({
      method: 'DELETE',
      url: `/api/v1/kb/documents/${docId}`,
      headers: authHeaders
    });
    expect(kbDelete.statusCode).toBe(200);

    await app.close();
  });

  it('supports tools and mcp management endpoints', async () => {
    const app = await buildApp({ difyApiClient: createMockDifyApiClient() });

    const toolsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/tools',
      headers: authHeaders
    });
    expect(toolsRes.statusCode).toBe(200);
    expect(toolsRes.json().items.length).toBeGreaterThanOrEqual(2);

    const disableToolRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tools/tool.echo/disable',
      headers: authHeaders
    });
    expect(disableToolRes.statusCode).toBe(200);
    expect(disableToolRes.json()).toMatchObject({ toolName: 'tool.echo', enabled: false });

    const executeDisabledRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tools/execute',
      headers: authHeaders,
      payload: {
        toolName: 'tool.echo',
        arguments: { text: 'hello' },
        sessionId: 'sess_1'
      }
    });
    expect(executeDisabledRes.statusCode).toBe(200);
    expect(executeDisabledRes.json()).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });

    const enableToolRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tools/tool.echo/enable',
      headers: authHeaders
    });
    expect(enableToolRes.statusCode).toBe(200);

    const executeEnabledRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tools/execute',
      headers: authHeaders,
      payload: {
        toolName: 'tool.echo',
        arguments: { text: 'hello' },
        sessionId: 'sess_1'
      }
    });
    expect(executeEnabledRes.statusCode).toBe(200);
    expect(executeEnabledRes.json()).toMatchObject({ ok: true, output: { text: 'hello' } });

    const deleteToolRes = await app.inject({
      method: 'DELETE',
      url: '/api/v1/tools/tool.echo',
      headers: authHeaders
    });
    expect(deleteToolRes.statusCode).toBe(200);

    const reloadToolsRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tools/reload',
      headers: authHeaders
    });
    expect(reloadToolsRes.statusCode).toBe(200);
    expect(reloadToolsRes.json().items.map((item: { toolName: string }) => item.toolName)).toContain('tool.echo');

    const executeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tools/execute',
      headers: authHeaders,
      payload: {
        toolName: 'tool.echo',
        arguments: { text: 'hello' },
        sessionId: 'sess_1'
      }
    });
    expect(executeRes.statusCode).toBe(200);
    expect(executeRes.json()).toMatchObject({ ok: true, output: { text: 'hello' } });

    const mcpAddRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tools/mcp/add',
      headers: authHeaders,
      payload: {
        name: 'server1',
        enabled: true,
        transport: 'stdio',
        command: 'node',
        timeoutSec: 5
      }
    });
    expect(mcpAddRes.statusCode).toBe(200);

    const mcpListRes = await app.inject({
      method: 'GET',
      url: '/api/v1/tools/mcp/servers',
      headers: authHeaders
    });
    expect(mcpListRes.statusCode).toBe(200);
    expect(mcpListRes.json().items.map((item: { name: string }) => item.name)).toContain('server1');

    const mcpTestRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tools/mcp/test',
      headers: authHeaders,
      payload: { name: 'server1' }
    });
    expect(mcpTestRes.statusCode).toBe(200);

    const mcpDisableRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tools/mcp/disable',
      headers: authHeaders,
      payload: { name: 'server1' }
    });
    expect(mcpDisableRes.statusCode).toBe(200);

    const mcpEnableRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tools/mcp/enable',
      headers: authHeaders,
      payload: { name: 'server1' }
    });
    expect(mcpEnableRes.statusCode).toBe(200);

    const mcpDeleteRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tools/mcp/delete',
      headers: authHeaders,
      payload: { name: 'server1' }
    });
    expect(mcpDeleteRes.statusCode).toBe(200);

    await app.close();
  });

  it('supports plugin lifecycle endpoints (local import/enable/disable/reload/delete)', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cwork-plugin-fixture-'));
    const pluginDir = join(root, 'demo-plugin');
    await mkdir(pluginDir, { recursive: true });
    await writeFile(
      join(pluginDir, 'cwork.plugin.json'),
      JSON.stringify({
        pluginId: 'demo.plugin',
        name: 'Demo Plugin',
        version: '0.1.0',
        compatibility: { minCoreVersion: '0.1.0' }
      }),
      'utf8'
    );

    const app = await buildApp({ difyApiClient: createMockDifyApiClient() });

    const importRes = await app.inject({
      method: 'POST',
      url: '/api/v1/plugins/import/local',
      headers: authHeaders,
      payload: { path: pluginDir }
    });
    expect(importRes.statusCode).toBe(200);
    expect(importRes.json()).toMatchObject({ pluginId: 'demo.plugin', source: 'local' });

    const enableRes = await app.inject({
      method: 'POST',
      url: '/api/v1/plugins/demo.plugin/enable',
      headers: authHeaders
    });
    expect(enableRes.statusCode).toBe(200);

    const disableRes = await app.inject({
      method: 'POST',
      url: '/api/v1/plugins/demo.plugin/disable',
      headers: authHeaders
    });
    expect(disableRes.statusCode).toBe(200);

    const reloadRes = await app.inject({
      method: 'POST',
      url: '/api/v1/plugins/demo.plugin/reload',
      headers: authHeaders
    });
    expect(reloadRes.statusCode).toBe(200);

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/plugins',
      headers: authHeaders
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().items.map((item: { pluginId: string }) => item.pluginId)).toContain('demo.plugin');

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: '/api/v1/plugins/demo.plugin',
      headers: authHeaders
    });
    expect(deleteRes.statusCode).toBe(200);

    await app.close();
    await rm(root, { recursive: true, force: true });
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
