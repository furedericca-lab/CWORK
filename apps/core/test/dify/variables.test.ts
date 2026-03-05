import { describe, expect, it } from 'vitest';
import { mergeDifyVariables } from '../../src/dify/variables';

describe('mergeDifyVariables', () => {
  it('uses deterministic override order provider < session < runtime', () => {
    const merged = mergeDifyVariables(
      { level: 'provider', locale: 'en', onlyProvider: true },
      { level: 'session', onlySession: true },
      { level: 'runtime', onlyRuntime: true }
    );

    expect(merged).toEqual({
      level: 'runtime',
      locale: 'en',
      onlyProvider: true,
      onlySession: true,
      onlyRuntime: true
    });
  });
});
