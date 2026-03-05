import { describe, expect, it } from 'vitest';
import { difyConfigSchema } from './dify';
import { pluginImportGitSchema, pluginImportLocalSchema } from './plugin';
import { skillDescriptorSchema } from './skill';
import { subagentDescriptorSchema, subagentHandoffSchema } from './subagent';

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

  it('rejects invalid subagent handoff payload', () => {
    const parsed = subagentHandoffSchema.safeParse({
      from: 'main',
      to: '',
      reason: ''
    });

    expect(parsed.success).toBe(false);
  });
});
