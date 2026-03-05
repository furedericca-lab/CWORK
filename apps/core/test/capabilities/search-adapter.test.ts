import { describe, expect, it } from 'vitest';
import { WebSearchAdapter } from '../../src/capabilities/search/adapter';

describe('WebSearchAdapter', () => {
  it('returns stable results for supported providers', async () => {
    const tavily = new WebSearchAdapter('tavily');
    const defaultProvider = new WebSearchAdapter('unknown-provider');

    const tavilyResult = await tavily.search('cwork');
    const defaultResult = await defaultProvider.search('cwork');

    expect(tavilyResult.provider).toBe('tavily');
    expect(tavilyResult.items.length).toBeGreaterThan(0);
    expect(defaultResult.provider).toBe('default');
  });
});
