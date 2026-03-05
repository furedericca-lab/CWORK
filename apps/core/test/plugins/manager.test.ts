import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { createInMemoryRepositories } from '../../src/repo/memory';
import { PermissionPolicy } from '../../src/policy/permissions';
import { PluginManager } from '../../src/plugins/manager';

const tempDirs: string[] = [];

const createTempDir = async (prefix: string) => {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
};

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('PluginManager', () => {
  it('imports local plugin and supports lifecycle with failure isolation', async () => {
    const sourceDir = await createTempDir('cwork-plugin-source-');
    const pluginDir = join(sourceDir, 'demo-plugin');
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

    const installRoot = await createTempDir('cwork-plugin-install-');

    const repositories = createInMemoryRepositories();
    const manager = new PluginManager(repositories.plugins, { rootDir: installRoot });

    const imported = await manager.importLocal({ path: pluginDir });
    expect(imported).toMatchObject({ pluginId: 'demo.plugin', status: 'disabled', source: 'local' });

    const enabled = await manager.enable('demo.plugin');
    expect(enabled.status).toBe('enabled');

    await rm(join(installRoot, 'demo.plugin'), { recursive: true, force: true });
    const reloaded = await manager.reload('demo.plugin');
    expect(reloaded.status).toBe('error');

    await manager.uninstall('demo.plugin');
    expect(await manager.list()).toHaveLength(0);
  });

  it('blocks denied plugin capabilities through policy guardrails', async () => {
    const sourceDir = await createTempDir('cwork-plugin-source-');
    const pluginDir = join(sourceDir, 'danger-plugin');
    await mkdir(pluginDir, { recursive: true });

    await writeFile(
      join(pluginDir, 'cwork.plugin.json'),
      JSON.stringify({
        pluginId: 'danger.plugin',
        name: 'Danger Plugin',
        version: '0.1.0',
        capabilities: ['shell.exec'],
        compatibility: { minCoreVersion: '0.1.0' }
      }),
      'utf8'
    );

    const installRoot = await createTempDir('cwork-plugin-install-');
    const repositories = createInMemoryRepositories();
    const manager = new PluginManager(repositories.plugins, {
      rootDir: installRoot,
      policy: new PermissionPolicy({ denyPluginCapabilities: ['shell.exec'] })
    });

    await expect(manager.importLocal({ path: pluginDir })).rejects.toThrow(/capability denied/);
  });
});
