import { execFile } from 'node:child_process';
import { cp, mkdir, readdir, readFile, rm, stat } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp } from 'node:fs/promises';
import type { SkillDescriptor } from '@cwork/shared';
import { AppError } from '../errors/app-error';
import { ERROR_CODE } from '../errors/error-code';
import { ensurePathInsideRoot, assertSafeArchiveEntry } from '../fs/path-safety';
import type { SkillRepository } from '../repo/interfaces';

export interface SkillManagerOptions {
  rootDir?: string;
  listArchiveEntries?: (zipPath: string) => Promise<string[]>;
  extractArchive?: (zipPath: string, destination: string) => Promise<void>;
}

const runExecFile = (command: string, args: string[]): Promise<string> =>
  new Promise((resolvePromise, reject) => {
    execFile(command, args, (error, stdout, stderr) => {
      if (error) {
        reject(new AppError(ERROR_CODE.INTERNAL_ERROR, `Command failed: ${command}`, { stderr, stdout }));
        return;
      }
      resolvePromise(stdout);
    });
  });

const defaultListArchiveEntries = async (zipPath: string): Promise<string[]> => {
  const stdout = await runExecFile('unzip', ['-Z1', zipPath]);
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
};

const defaultExtractArchive = async (zipPath: string, destination: string): Promise<void> => {
  await runExecFile('unzip', ['-o', zipPath, '-d', destination]);
};

const parseSkillMeta = async (skillDir: string): Promise<Pick<SkillDescriptor, 'name' | 'description' | 'scope'>> => {
  const manifestPath = join(skillDir, 'skill.json');
  try {
    const content = await readFile(manifestPath, 'utf8');
    const manifest = JSON.parse(content) as { name?: string; description?: string; scope?: SkillDescriptor['scope'] };
    return {
      name: manifest.name ?? basename(skillDir),
      description: manifest.description,
      scope: manifest.scope ?? 'both'
    };
  } catch {
    return {
      name: basename(skillDir),
      scope: 'both'
    };
  }
};

export class SkillManager {
  private readonly rootDir: string;
  private readonly listArchiveEntries: (zipPath: string) => Promise<string[]>;
  private readonly extractArchive: (zipPath: string, destination: string) => Promise<void>;

  constructor(
    private readonly repository: SkillRepository,
    options: SkillManagerOptions = {}
  ) {
    this.rootDir = options.rootDir ?? resolve(process.cwd(), '.runtime/skills');
    this.listArchiveEntries = options.listArchiveEntries ?? defaultListArchiveEntries;
    this.extractArchive = options.extractArchive ?? defaultExtractArchive;
  }

  async ensureRoot(): Promise<void> {
    await mkdir(this.rootDir, { recursive: true });
  }

  async reload(): Promise<SkillDescriptor[]> {
    await this.ensureRoot();

    const dirents = await readdir(this.rootDir, { withFileTypes: true });
    const skills: SkillDescriptor[] = [];

    for (const dirent of dirents) {
      if (!dirent.isDirectory()) {
        continue;
      }

      const skillId = dirent.name;
      const skillDir = join(this.rootDir, skillId);
      const meta = await parseSkillMeta(skillDir);
      const existing = await this.repository.get(skillId);
      const descriptor: SkillDescriptor = {
        skillId,
        name: meta.name,
        enabled: existing?.enabled ?? true,
        scope: meta.scope,
        ...(meta.description ? { description: meta.description } : {})
      };

      await this.repository.upsert(descriptor);
      skills.push(descriptor);
    }

    return skills;
  }

  async list(): Promise<SkillDescriptor[]> {
    return this.repository.list();
  }

  async buildPromptBlock(): Promise<string> {
    const skills = await this.repository.list();
    const active = skills.filter((item) => item.enabled);
    if (active.length === 0) {
      return 'No active skills.';
    }

    return active
      .map((skill) => {
        const label = skill.scope ?? 'both';
        return `- ${skill.skillId} [${label}] ${skill.description ?? ''}`.trim();
      })
      .join('\n');
  }

  async importZip(zipPath: string): Promise<SkillDescriptor> {
    await this.ensureRoot();

    const zipStat = await stat(zipPath).catch(() => null);
    if (!zipStat || !zipStat.isFile()) {
      throw new AppError(ERROR_CODE.NOT_FOUND, `Skill zip not found: ${zipPath}`);
    }

    const entries = await this.listArchiveEntries(zipPath);
    if (entries.length === 0) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, 'Skill archive is empty');
    }

    for (const entry of entries) {
      assertSafeArchiveEntry(entry);
    }

    const roots = new Set(
      entries.map((entry) => entry.split('/').filter(Boolean)[0]).filter((entry): entry is string => Boolean(entry))
    );

    if (roots.size !== 1) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, 'Skill archive must contain a single root folder');
    }

    const [skillId] = Array.from(roots);
    if (!skillId) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, 'Skill archive root folder is missing');
    }
    const tempDir = await mkdtemp(join(tmpdir(), 'cwork-skill-'));

    try {
      await this.extractArchive(zipPath, tempDir);

      const sourceSkillDir = resolve(tempDir, skillId);
      ensurePathInsideRoot(tempDir, sourceSkillDir);

      const targetSkillDir = resolve(this.rootDir, skillId);
      ensurePathInsideRoot(this.rootDir, targetSkillDir);

      await rm(targetSkillDir, { recursive: true, force: true });
      await mkdir(this.rootDir, { recursive: true });
      await cp(sourceSkillDir, targetSkillDir, { recursive: true });

      const meta = await parseSkillMeta(targetSkillDir);
      const descriptor: SkillDescriptor = {
        skillId,
        name: meta.name,
        enabled: true,
        scope: meta.scope,
        ...(meta.description ? { description: meta.description } : {})
      };

      await this.repository.upsert(descriptor);
      return descriptor;
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  async enable(skillId: string): Promise<SkillDescriptor> {
    const found = await this.repository.get(skillId);
    if (!found) {
      throw new AppError(ERROR_CODE.NOT_FOUND, `Skill not found: ${skillId}`);
    }

    const next: SkillDescriptor = {
      ...found,
      enabled: true
    };
    await this.repository.upsert(next);
    return next;
  }

  async disable(skillId: string): Promise<SkillDescriptor> {
    const found = await this.repository.get(skillId);
    if (!found) {
      throw new AppError(ERROR_CODE.NOT_FOUND, `Skill not found: ${skillId}`);
    }

    const next: SkillDescriptor = {
      ...found,
      enabled: false
    };
    await this.repository.upsert(next);
    return next;
  }

  async delete(skillId: string): Promise<void> {
    const target = resolve(this.rootDir, skillId);
    ensurePathInsideRoot(this.rootDir, target);

    await rm(target, { recursive: true, force: true });
    await this.repository.delete(skillId);
  }

  async getDownloadPath(skillId: string): Promise<string> {
    const found = await this.repository.get(skillId);
    if (!found) {
      throw new AppError(ERROR_CODE.NOT_FOUND, `Skill not found: ${skillId}`);
    }

    const target = resolve(this.rootDir, skillId);
    ensurePathInsideRoot(this.rootDir, target);
    return target;
  }
}
