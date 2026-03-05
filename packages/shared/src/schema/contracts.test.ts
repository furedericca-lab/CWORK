import { describe, expect, it } from 'vitest';
import { difyConfigSchema } from './dify';
import { pluginImportGitSchema, pluginImportLocalSchema } from './plugin';
import { capabilityStatusResponseSchema } from './capability';
import { knowledgeDocumentCreateSchema, knowledgeRetrieveRequestSchema } from './knowledge';
import { mcpServerConfigSchema } from './mcp';
import { proactiveJobCreateRequestSchema } from './proactive';
import { skillDescriptorSchema, skillImportRequestSchema } from './skill';
import { subagentConfigSchema, subagentDescriptorSchema, subagentHandoffSchema } from './subagent';
import { toolExecuteRequestSchema, toolItemSchema } from './tool';

describe('difyConfigSchema', () => {
  it('accepts valid config', () => {
    const parsed = difyConfigSchema.safeParse({
      providerId: 'default',
      difyApiKey: '${DIFY_API_KEY}',
      difyApiBase: 'https://api.dify.ai/v1',
      difyApiType: 'chat',
      difyWorkflowOutputKey: 'wf_output',
      difyQueryInputKey: 'query',
      timeoutSec: 30
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects non-positive timeoutSec', () => {
    const parsed = difyConfigSchema.safeParse({
      providerId: 'default',
      difyApiBase: 'https://api.dify.ai/v1',
      difyApiType: 'chat',
      difyWorkflowOutputKey: 'wf_output',
      difyQueryInputKey: 'query',
      timeoutSec: 0
    });

    expect(parsed.success).toBe(false);
  });
});

describe('plugin schemas', () => {
  it('accepts local import payload', () => {
    const parsed = pluginImportLocalSchema.safeParse({ path: '/opt/plugins/hello' });
    expect(parsed.success).toBe(true);
  });

  it('rejects empty git import payload', () => {
    const parsed = pluginImportGitSchema.safeParse({ repoUrl: '' });
    expect(parsed.success).toBe(false);
  });
});

describe('skill and subagent schemas', () => {
  it('accepts skill descriptor', () => {
    const parsed = skillDescriptorSchema.safeParse({
      skillId: 'skill.search',
      name: 'Search',
      scope: 'both',
      enabled: true
    });

    expect(parsed.success).toBe(true);
  });

  it('accepts subagent descriptor and handoff payload', () => {
    const subagent = subagentDescriptorSchema.safeParse({
      subagentId: 'research',
      name: 'Research SubAgent',
      enabled: true,
      tools: ['web.search']
    });

    const handoff = subagentHandoffSchema.safeParse({
      from: 'main',
      to: 'research',
      reason: 'need web research'
    });

    expect(subagent.success).toBe(true);
    expect(handoff.success).toBe(true);
  });

  it('supports backward-compatible subagent config mapping (enable -> mainEnable)', () => {
    const parsed = subagentConfigSchema.safeParse({
      enable: true,
      removeMainDuplicateTools: true,
      agents: []
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      throw new Error('subagent config parse failed');
    }
    expect(parsed.data.mainEnable).toBe(true);
  });

  it('rejects invalid subagent handoff payload', () => {
    const parsed = subagentHandoffSchema.safeParse({
      from: 'main',
      to: '',
      reason: ''
    });

    expect(parsed.success).toBe(false);
  });
});

describe('tool and mcp schemas', () => {
  it('accepts tool item and execute request', () => {
    const tool = toolItemSchema.safeParse({
      toolName: 'web.search',
      description: 'search web',
      enabled: true,
      schema: {
        query: {
          type: 'string',
          required: true
        }
      },
      source: 'builtin'
    });

    const request = toolExecuteRequestSchema.safeParse({
      toolName: 'web.search',
      arguments: { query: 'cwork' },
      sessionId: 'sess_1'
    });

    expect(tool.success).toBe(true);
    expect(request.success).toBe(true);
  });

  it('validates mcp transport requirements', () => {
    const invalid = mcpServerConfigSchema.safeParse({
      name: 'mcp_stdio',
      enabled: true,
      transport: 'stdio',
      timeoutSec: 10
    });

    const valid = mcpServerConfigSchema.safeParse({
      name: 'mcp_http',
      enabled: true,
      transport: 'http',
      url: 'https://example.com/mcp',
      timeoutSec: 10
    });

    expect(invalid.success).toBe(false);
    expect(valid.success).toBe(true);
  });

  it('accepts skill import request', () => {
    const parsed = skillImportRequestSchema.safeParse({ zipPath: '/tmp/skill.zip' });
    expect(parsed.success).toBe(true);
  });
});

describe('phase4 schemas', () => {
  it('validates proactive create payload', () => {
    const valid = proactiveJobCreateRequestSchema.safeParse({
      name: 'daily-briefing',
      sessionId: 'sess_1',
      prompt: 'run',
      cronExpression: '*/10 * * * * *'
    });
    const invalid = proactiveJobCreateRequestSchema.safeParse({
      name: 'bad',
      sessionId: 'sess_1',
      prompt: 'run'
    });

    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it('validates capability and knowledge schemas', () => {
    const caps = capabilityStatusResponseSchema.safeParse({
      dify: { enabled: true, healthy: true },
      plugins: { enabled: true, healthy: true },
      skills: { enabled: true, healthy: true },
      mcp: { enabled: true, healthy: true },
      search: { enabled: true, healthy: true },
      knowledge: { enabled: true, healthy: true },
      sandbox: { enabled: false, healthy: true }
    });

    const kbDoc = knowledgeDocumentCreateSchema.safeParse({
      title: 'doc',
      content: 'hello'
    });

    const kbRetrieve = knowledgeRetrieveRequestSchema.safeParse({
      query: 'hello',
      topK: 3
    });

    expect(caps.success).toBe(true);
    expect(kbDoc.success).toBe(true);
    expect(kbRetrieve.success).toBe(true);
  });
});
