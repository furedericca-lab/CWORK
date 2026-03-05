import { describe, expect, it } from 'vitest';
import { PermissionPolicy } from '../../src/policy/permissions';

describe('PermissionPolicy', () => {
  it('blocks denied tools and plugin capabilities', () => {
    const policy = new PermissionPolicy({
      denyTools: ['danger.tool'],
      denyPluginCapabilities: ['shell.exec']
    });

    expect(() => policy.assertToolAllowed('danger.tool')).toThrow(/denied/);
    expect(() => policy.assertPluginCapabilities(['shell.exec'])).toThrow(/denied/);
  });

  it('enforces allowlist when configured', () => {
    const policy = new PermissionPolicy({
      allowTools: ['tool.echo']
    });

    expect(() => policy.assertToolAllowed('tool.echo')).not.toThrow();
    expect(() => policy.assertToolAllowed('tool.other')).toThrow(/allowlist/);
  });
});
