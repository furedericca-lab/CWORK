import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { assertPluginCompatibility, loadPluginManifest } from '../../src/plugins/manifest';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('plugin manifest compatibility', () => {
  it('loads manifest and validates compatibility matrix', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cwork-plugin-manifest-'));
    tempDirs.push(dir);

    await writeFile(
      join(dir, 'cwork.plugin.json'),
      JSON.stringify({
        pluginId: 'demo.plugin',
        name: 'Demo Plugin',
        version: '0.1.0',
        capabilities: ['tool.echo'],
        compatibility: {
          minCoreVersion: '0.1.0'
        }
      }),
      'utf8'
    );

    const manifest = await loadPluginManifest(dir);
    expect(manifest.pluginId).toBe('demo.plugin');

    expect(() => assertPluginCompatibility(manifest, '0.1.0')).not.toThrow();
    expect(() => assertPluginCompatibility(manifest, '0.0.9')).toThrow(/requires core version/);
  });
});
