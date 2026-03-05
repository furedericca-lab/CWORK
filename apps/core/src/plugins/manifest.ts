import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AppError } from '../errors/app-error';
import { ERROR_CODE } from '../errors/error-code';

export interface PluginManifest {
  pluginId: string;
  name: string;
  version: string;
  capabilities: string[];
  compatibility: {
    minCoreVersion: string;
  };
}

const parseVersion = (value: string): [number, number, number] => {
  const parts = value.replace(/^v/, '').split('.').map((item) => Number(item));
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
};

const compareVersion = (a: string, b: string): number => {
  const pa = parseVersion(a);
  const pb = parseVersion(b);

  for (const i of [0, 1, 2] as const) {
    if (pa[i] > pb[i]) {
      return 1;
    }
    if (pa[i] < pb[i]) {
      return -1;
    }
  }

  return 0;
};

export const assertPluginCompatibility = (manifest: PluginManifest, coreVersion: string): void => {
  if (compareVersion(coreVersion, manifest.compatibility.minCoreVersion) < 0) {
    throw new AppError(
      ERROR_CODE.VALIDATION_ERROR,
      `Plugin requires core version >= ${manifest.compatibility.minCoreVersion}, current ${coreVersion}`
    );
  }
};

const parsePackageJsonFallback = async (pluginDir: string): Promise<PluginManifest> => {
  const raw = await readFile(join(pluginDir, 'package.json'), 'utf8').catch(() => null);
  if (!raw) {
    throw new AppError(ERROR_CODE.VALIDATION_ERROR, `Plugin manifest not found in ${pluginDir}`);
  }

  const parsed = JSON.parse(raw) as {
    name?: string;
    version?: string;
    cworkPlugin?: {
      pluginId?: string;
      capabilities?: string[];
      minCoreVersion?: string;
    };
  };

  const pluginId = parsed.cworkPlugin?.pluginId ?? parsed.name;
  const version = parsed.version ?? '0.0.0';

  if (!pluginId) {
    throw new AppError(ERROR_CODE.VALIDATION_ERROR, 'pluginId is missing in plugin manifest');
  }

  return {
    pluginId,
    name: parsed.name ?? pluginId,
    version,
    capabilities: parsed.cworkPlugin?.capabilities ?? [],
    compatibility: {
      minCoreVersion: parsed.cworkPlugin?.minCoreVersion ?? '0.1.0'
    }
  };
};

export const loadPluginManifest = async (pluginDir: string): Promise<PluginManifest> => {
  const manifestPath = join(pluginDir, 'cwork.plugin.json');
  const raw = await readFile(manifestPath, 'utf8').catch(() => null);
  if (!raw) {
    return parsePackageJsonFallback(pluginDir);
  }

  const parsed = JSON.parse(raw) as Partial<PluginManifest>;
  if (!parsed.pluginId || !parsed.name || !parsed.version) {
    throw new AppError(ERROR_CODE.VALIDATION_ERROR, `Invalid plugin manifest at ${manifestPath}`);
  }

  return {
    pluginId: parsed.pluginId,
    name: parsed.name,
    version: parsed.version,
    capabilities: parsed.capabilities ?? [],
    compatibility: {
      minCoreVersion: parsed.compatibility?.minCoreVersion ?? '0.1.0'
    }
  };
};
