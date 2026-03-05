import { describe, expect, it } from 'vitest';
import { DifyConfigService } from '../../src/dify/dify-config.service';
import { createInMemoryRepositories } from '../../src/repo/memory';

describe('DifyConfigService', () => {
  it('returns masked config and preserves secret in storage', async () => {
    const repositories = createInMemoryRepositories();
    const service = new DifyConfigService(repositories.difyConfig);

    await service.updateConfig({
      providerId: 'default',
      difyApiKey: 'sk-secret',
      difyApiBase: 'https://api.dify.ai/v1',
      difyApiType: 'chat',
      difyWorkflowOutputKey: 'wf_output',
      difyQueryInputKey: 'query',
      timeoutSec: 30,
      variables: {}
    });

    const masked = await service.getMaskedConfig();
    const stored = await repositories.difyConfig.get();

    expect(masked.masked.difyApiKey).toBe('***');
    expect(stored.difyApiKey).toBe('sk-secret');
  });

  it('rejects invalid difyApiType', async () => {
    const repositories = createInMemoryRepositories();
    const service = new DifyConfigService(repositories.difyConfig);

    await expect(
      service.updateConfig({
        providerId: 'default',
        difyApiKey: 'sk-secret',
        difyApiBase: 'https://api.dify.ai/v1',
        difyApiType: 'invalid',
        difyWorkflowOutputKey: 'wf_output',
        difyQueryInputKey: 'query',
        timeoutSec: 30,
        variables: {}
      })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('resolves env template api key', async () => {
    process.env.DIFY_API_KEY = 'resolved-key';

    const repositories = createInMemoryRepositories();
    await repositories.difyConfig.set({
      providerId: 'default',
      difyApiKey: '${DIFY_API_KEY}',
      difyApiBase: 'https://api.dify.ai/v1',
      difyApiType: 'chat',
      difyWorkflowOutputKey: 'wf_output',
      difyQueryInputKey: 'query',
      timeoutSec: 30,
      variables: {}
    });

    const service = new DifyConfigService(repositories.difyConfig);
    await expect(service.getResolvedApiKey()).resolves.toBe('resolved-key');
  });
});
