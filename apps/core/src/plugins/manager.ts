import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, rm, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import type { PluginImportGitRequest, PluginImportLocalRequest, PluginItem } from '@cwork/shared';
import { AppError } from '../errors/app-error';
import { ERROR_CODE } from '../errors/error-code';
import { ensurePathInsideRoot } from '../fs/path-safety';
import { PermissionPolicy } from '../policy/permissions';
import type { PluginRepository } from '../repo/interfaces';
import { assertPluginCompatibility, loadPluginManifest } from './manifest';

export interface PluginManagerOptions {
  rootDir?: string;
  coreVersion?: string;
  policy?: PermissionPolicy;
}

const runExecFile = (command: string, args: string[], cwd?: string): Promise<void> =>
  new Promise((resolvePromise, reject) => {
    execFile(command, args, { cwd }, (error, _stdout, stderr) => {
      if (error) {
        reject(new AppError(ERROR_CODE.INTERNAL_ERROR, `Command failed: ${command}`, { stderr }));
        return;
      }
      resolvePromise();
    });
  });

const toInstallDirName = (pluginId: string): string => pluginId.replace(/[^a-zA-Z0-9._-]/g, '_');

export class PluginManager {
  private readonly rootDir: string;
  private readonly coreVersion: string;
  private readonly policy: PermissionPolicy;

  constructor(
    private readonly repository: PluginRepository,
    options: PluginManagerOptions = {}
  ) {
    this.rootDir = options.rootDir ?? resolve(process.cwd(), '.runtime/plugins');
    this.coreVersion = options.coreVersion ?? '0.1.0';
    this.policy = options.policy ?? new PermissionPolicy();
  }

  async ensureRoot(): Promise<void> {
    await mkdir(this.rootDir, { recursive: true });
  }

  async list(): Promise<PluginItem[]> {
    return this.repository.list();
  }

  async importLocal(input: PluginImportLocalRequest): Promise<PluginItem> {
    await this.ensureRoot();

    const src = resolve(input.path);
    const srcStat = await stat(src).catch(() => null);
    if (!srcStat || !srcStat.isDirectory()) {
      throw new AppError(ERROR_CODE.NOT_FOUND, `Plugin path not found: ${input.path}`);
    }

    const manifest = await loadPluginManifest(src);
    assertPluginCompatibility(manifest, this.coreVersion);
    this.policy.assertPluginCapabilities(manifest.capabilities);

    const installDir = resolve(this.rootDir, toInstallDirName(manifest.pluginId));
    ensurePathInsideRoot(this.rootDir, installDir);

    await rm(installDir, { recursive: true, force: true });
    await cp(src, installDir, { recursive: true });
    await rm(join(installDir, '.git'), { recursive: true, force: true });

    const item: PluginItem = {
      pluginId: manifest.pluginId,
      name: manifest.name,
      version: manifest.version,
      source: 'local',
      status: 'disabled',
      error: null
    };

    await this.repository.upsert(item);
    return item;
  }

  async importGit(input: PluginImportGitRequest): Promise<PluginItem> {
    await this.ensureRoot();

    const tempDir = await mkdtemp(join(tmpdir(), 'cwork-plugin-'));

    try {
      await runExecFile('git', ['clone', input.repoUrl, tempDir]);
      if (input.ref) {
        await runExecFile('git', ['checkout', input.ref], tempDir);
      }

      const manifest = await loadPluginManifest(tempDir);
      assertPluginCompatibility(manifest, this.coreVersion);
      this.policy.assertPluginCapabilities(manifest.capabilities);

      const installDir = resolve(this.rootDir, toInstallDirName(manifest.pluginId));
      ensurePathInsideRoot(this.rootDir, installDir);

      await rm(installDir, { recursive: true, force: true });

      try {
        await cp(tempDir, installDir, { recursive: true });
        await rm(join(installDir, '.git'), { recursive: true, force: true });
      } catch (error) {
        await rm(installDir, { recursive: true, force: true });
        throw error;
      }

      const item: PluginItem = {
        pluginId: manifest.pluginId,
        name: manifest.name,
        version: manifest.version,
        source: 'git',
        status: 'disabled',
        error: null
      };

      await this.repository.upsert(item);
      return item;
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  async enable(pluginId: string): Promise<PluginItem> {
    const found = await this.repository.get(pluginId);
    if (!found) {
      throw new AppError(ERROR_CODE.NOT_FOUND, `Plugin not found: ${pluginId}`);
    }

    try {
      const installDir = resolve(this.rootDir, toInstallDirName(pluginId));
      ensurePathInsideRoot(this.rootDir, installDir);
      const manifest = await loadPluginManifest(installDir);
      assertPluginCompatibility(manifest, this.coreVersion);
      this.policy.assertPluginCapabilities(manifest.capabilities);

      const next: PluginItem = {
        ...found,
        status: 'enabled',
        error: null
      };
      await this.repository.upsert(next);
      return next;
    } catch (error) {
      const next: PluginItem = {
        ...found,
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      };
      await this.repository.upsert(next);
      return next;
    }
  }

  async disable(pluginId: string): Promise<PluginItem> {
    const found = await this.repository.get(pluginId);
    if (!found) {
      throw new AppError(ERROR_CODE.NOT_FOUND, `Plugin not found: ${pluginId}`);
    }

    const next: PluginItem = {
      ...found,
      status: 'disabled',
      error: null
    };
    await this.repository.upsert(next);
    return next;
  }

  async reload(pluginId: string): Promise<PluginItem> {
    const found = await this.repository.get(pluginId);
    if (!found) {
      throw new AppError(ERROR_CODE.NOT_FOUND, `Plugin not found: ${pluginId}`);
    }

    if (found.status === 'enabled') {
      return this.enable(pluginId);
    }

    const next: PluginItem = {
      ...found,
      status: 'disabled',
      error: null
    };
    await this.repository.upsert(next);
    return next;
  }

  async uninstall(pluginId: string): Promise<void> {
    const found = await this.repository.get(pluginId);
    if (!found) {
      return;
    }

    const installDir = resolve(this.rootDir, toInstallDirName(pluginId));
    ensurePathInsideRoot(this.rootDir, installDir);
    await rm(installDir, { recursive: true, force: true });
    await this.repository.delete(pluginId);
  }
}
